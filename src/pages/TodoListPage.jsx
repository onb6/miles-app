import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import DatePicker from "react-datepicker";
import { BiArrowBack, BiPlus, BiTrash, BiCopy, BiCheck, BiTransferAlt, BiPencil, BiArchiveIn, BiArchiveOut, BiSearch } from "react-icons/bi";
import ProfileDropdown from "../components/ProfileDropdown";
import "react-datepicker/dist/react-datepicker.css";
import "./TodoListPage.css";

const PRESENCE_COLORS = ["#e05c7e", "#9b7fe8", "#e8923c", "#3cb8a0"];
const getUserColor = (userId) => PRESENCE_COLORS[(userId - 1) % PRESENCE_COLORS.length];

const formatRelativeTime = (dateStr) => {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// ─── TodoItem ─────────────────────────────────────────────────────────────────
const TodoItem = ({
  item,
  onToggle,
  onDelete,
  onEditText,
  onStartEditing,
  onStopEditing,
  editingUser,
  flashColor,
  readOnly,
}) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => { setEditText(item.text); }, [item.text]);

  const startEditing = () => {
    if (readOnly) return;
    setEditing(true);
    onStartEditing?.(item.id);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const finishEditing = () => {
    setEditing(false);
    onStopEditing?.(item.id);
    if (editText.trim() !== item.text) onEditText(item, editText);
  };

  return (
    <div
      className={`todo-item${item.completed ? " completed" : ""}${flashColor ? " todo-flashing" : ""}${editingUser ? " peer-editing" : ""}${readOnly ? " read-only" : ""}`}
      style={{
        ...(flashColor ? { "--flash-color": flashColor + "28" } : {}),
        ...(editingUser ? { "--peer-color": editingUser.color } : {}),
      }}
    >
      <button
        className="todo-item-checkbox"
        onClick={readOnly ? undefined : () => onToggle(item)}
        disabled={readOnly}
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
      >
        {item.completed && <span className="checkmark">✓</span>}
      </button>

      <div className="todo-item-body">
        {editing ? (
          <input
            ref={inputRef}
            className="todo-item-edit-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishEditing();
              if (e.key === "Escape") { setEditing(false); onStopEditing?.(item.id); setEditText(item.text); }
            }}
          />
        ) : (
          <span className="todo-item-text" onDoubleClick={startEditing}>
            {item.text}
          </span>
        )}
        {editingUser && (
          <span className="todo-peer-label" style={{ color: editingUser.color }}>
            {editingUser.username} is editing…
          </span>
        )}
      </div>

      {!readOnly && (
        <>
          <button className="todo-item-copy" onClick={handleCopy} aria-label="Copy item">
            {copied ? <BiCheck /> : <BiCopy />}
          </button>
          <button className="todo-item-delete" onClick={() => onDelete(item.id)} aria-label="Delete item">
            ×
          </button>
        </>
      )}
    </div>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────
const TodoListPage = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  // sidebar
  const [tab, setTab] = useState("active"); // "active" | "archived"
  const [search, setSearch] = useState("");
  // move modal
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [newListName, setNewListName] = useState("");
  const [moving, setMoving] = useState(false);
  // presence
  const [presenceUsers, setPresenceUsers] = useState([]);      // [{userId, username}]
  const [editingItems, setEditingItems] = useState(new Map()); // itemId → {userId, username, color}
  const [editingFields, setEditingFields] = useState(new Map()); // "title"|"start_date"|"end_date" → peer
  const [flashItems, setFlashItems] = useState(new Map());     // itemId → color

  const socketRef = useRef(null);
  const prevListIdRef = useRef(null);
  const titleDebounceRef = useRef(null);
  const selectedListIdRef = useRef(null);
  const titleFocusedRef = useRef(false);
  const iconInputRef = useRef(null);
  const startDateClearRef = useRef(null);
  const endDateClearRef = useRef(null);
  selectedListIdRef.current = selectedListId;

  const clearUserEditing = (userId) => {
    const clearMap = (setter) =>
      setter((prev) => {
        const next = new Map(prev);
        for (const [k, v] of next) { if (v.userId === userId) next.delete(k); }
        return next;
      });
    clearMap(setEditingItems);
    clearMap(setEditingFields);
  };

  // Connect socket once
  useEffect(() => {
    const socket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("[socket] connection error:", err.message);
    });

    // ── list events ──
    socket.on("list-added", (list) => {
      setLists((prev) => (prev.find((l) => l.id === list.id) ? prev : [list, ...prev]));
    });
    socket.on("list-updated", (list) => {
      setLists((prev) =>
        [...prev.map((l) => (l.id === list.id ? list : l))].sort(
          (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
        )
      );
      if (list.id === selectedListIdRef.current) {
        if (!titleFocusedRef.current) setTitle(list.title);
        setStartDate(list.start_date ? list.start_date.slice(0, 10) : "");
        setEndDate(list.end_date ? list.end_date.slice(0, 10) : "");
      }
    });
    socket.on("list-deleted", ({ id }) => {
      setLists((prev) => prev.filter((l) => l.id !== id));
      setSelectedListId((prev) => (prev === id ? null : prev));
    });

    // ── item events ──
    socket.on("item-added", (item) => {
      setItems((prev) => (prev.find((i) => i.id === item.id) ? prev : [...prev, item]));
    });
    socket.on("item-updated", (item) => {
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    });
    socket.on("item-deleted", ({ id }) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    });

    // ── presence events ──
    socket.on("presence-init", (users) => {
      setPresenceUsers(users);
    });
    socket.on("presence-joined", ({ userId, username }) => {
      setPresenceUsers((prev) =>
        prev.find((u) => u.userId === userId) ? prev : [...prev, { userId, username }]
      );
    });
    socket.on("presence-left", ({ userId }) => {
      setPresenceUsers((prev) => prev.filter((u) => u.userId !== userId));
      clearUserEditing(userId);
    });

    // ── activity events ──
    socket.on("user-activity", ({ userId, username, type, itemId, field }) => {
      const color = getUserColor(userId);
      if (type === "click" && itemId) {
        setFlashItems((prev) => new Map(prev).set(itemId, color));
        setTimeout(() => {
          setFlashItems((prev) => { const n = new Map(prev); n.delete(itemId); return n; });
        }, 900);
      } else if (type === "editing") {
        if (itemId) {
          setEditingItems((prev) => new Map(prev).set(itemId, { userId, username, color }));
        } else if (field) {
          setEditingFields((prev) => new Map(prev).set(field, { userId, username, color }));
        }
      } else if (type === "idle") {
        clearUserEditing(userId);
      }
    });

    return () => socket.disconnect();
  }, []);

  // Join/leave rooms + reset presence
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (prevListIdRef.current) {
      socket.emit("leave-list", prevListIdRef.current);
      setPresenceUsers([]);
      setEditingItems(new Map());
      setEditingFields(new Map());
      setFlashItems(new Map());
    }
    if (selectedListId) socket.emit("join-list", selectedListId);
    prevListIdRef.current = selectedListId;
  }, [selectedListId]);

  // Fetch lists
  useEffect(() => {
    fetch("/api/todos", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setLists(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Fetch items when list changes
  useEffect(() => {
    if (!selectedListId) { setItems([]); setTitle(""); setStartDate(""); setEndDate(""); return; }
    const list = lists.find((l) => l.id === selectedListId);
    if (list) {
      setTitle(list.title);
      setStartDate(list.start_date ? list.start_date.slice(0, 10) : "");
      setEndDate(list.end_date ? list.end_date.slice(0, 10) : "");
    }
    setItemsLoading(true);
    fetch(`/api/todos/${selectedListId}/items`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setItems(data); setItemsLoading(false); })
      .catch(() => setItemsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId]);

  const emitActivity = (type, itemId = null, field = null) => {
    if (!socketRef.current || !selectedListIdRef.current) return;
    socketRef.current.emit("user-activity", {
      listId: selectedListIdRef.current,
      type,
      itemId,
      field,
    });
  };

  const createList = async () => {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: "Untitled List" }),
    });
    if (!res.ok) return;
    const list = await res.json();
    setSelectedListId(list.id);
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setLists((prev) => prev.map((l) => (l.id === selectedListId ? { ...l, title: newTitle } : l)));
    clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      if (!newTitle.trim()) return;
      fetch(`/api/todos/${selectedListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle }),
      });
    }, 600);
  };

  // Use local date parts to avoid UTC midnight shifting the date in UTC+ timezones
  const toIso = (date) => {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const handleDateChange = async (field, date) => {
    const iso = toIso(date);
    if (field === "start_date") setStartDate(iso || "");
    else setEndDate(iso || "");
    const res = await fetch(`/api/todos/${selectedListId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ [field]: iso }),
    });
    if (!res.ok) console.error("Failed to save date:", await res.text());
  };

  // Keep refs current so the stable container memos always call the latest handler
  startDateClearRef.current = () => handleDateChange("start_date", null);
  endDateClearRef.current = () => handleDateChange("end_date", null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startDateContainer = useMemo(() => ({ className, children }) => (
    <div className="todo-calendar-with-clear">
      <div className={className}>{children}</div>
      <div className="todo-datepicker-clear-row">
        <button
          className="todo-datepicker-clear-btn"
          onMouseDown={(e) => { e.preventDefault(); startDateClearRef.current?.(); }}
        >
          Clear date
        </button>
      </div>
    </div>
  ), []); // stable reference; reads from ref at call time

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const endDateContainer = useMemo(() => ({ className, children }) => (
    <div className="todo-calendar-with-clear">
      <div className={className}>{children}</div>
      <div className="todo-datepicker-clear-row">
        <button
          className="todo-datepicker-clear-btn"
          onMouseDown={(e) => { e.preventDefault(); endDateClearRef.current?.(); }}
        >
          Clear date
        </button>
      </div>
    </div>
  ), []); // stable reference; reads from ref at call time

  const handleDeleteList = async (listId) => {
    if (!window.confirm("Delete this list and all its items?")) return;
    await fetch(`/api/todos/${listId}`, { method: "DELETE", credentials: "include" });
    setLists((prev) => prev.filter((l) => l.id !== listId));
    if (selectedListId === listId) setSelectedListId(null);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || !selectedListId) return;
    const text = newItemText.trim();
    setNewItemText("");
    const res = await fetch(`/api/todos/${selectedListId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const item = await res.json();
    setItems((prev) => (prev.find((i) => i.id === item.id) ? prev : [...prev, item]));
  };

  const handleToggleItem = async (item) => {
    emitActivity("click", item.id);
    const res = await fetch(`/api/todos/${selectedListId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ completed: !item.completed }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleDeleteItem = async (itemId) => {
    const res = await fetch(`/api/todos/${selectedListId}/items/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleEditItemText = async (item, newText) => {
    if (!newText.trim()) { await handleDeleteItem(item.id); return; }
    const res = await fetch(`/api/todos/${selectedListId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text: newText.trim() }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleArchiveToggle = async () => {
    const currentList = lists.find((l) => l.id === selectedListId);
    if (!currentList) return;
    await fetch(`/api/todos/${selectedListId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ archived: !currentList.archived }),
    });
    // list-updated socket event will sync state for both users
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedListId) return;
    e.target.value = "";
    const formData = new FormData();
    formData.append("icon", file);
    const res = await fetch(`/api/todos/${selectedListId}/icon`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) return;
    const { icon_url } = await res.json();
    setLists((prev) =>
      prev.map((l) => (l.id === selectedListId ? { ...l, icon_url } : l))
    );
  };

  const handleMoveItems = async () => {
    const incomplete = items.filter((i) => !i.completed);
    if (incomplete.length === 0) { setShowMoveModal(false); return; }
    setMoving(true);
    let targetId = moveTarget;
    if (moveTarget === "new") {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newListName.trim() || "Untitled List" }),
      });
      if (!res.ok) { setMoving(false); return; }
      const newList = await res.json();
      targetId = newList.id;
    }
    await Promise.all(
      incomplete.map((item) =>
        fetch(`/api/todos/${targetId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: item.text }),
        })
      )
    );
    await Promise.all(
      incomplete.map((item) =>
        fetch(`/api/todos/${selectedListId}/items/${item.id}`, {
          method: "DELETE",
          credentials: "include",
        })
      )
    );
    setItems((prev) => prev.filter((i) => i.completed));
    setMoving(false);
    setShowMoveModal(false);
    setMoveTarget("");
    setNewListName("");
  };

  return (
    <div className="todo-page">
      <header className="todo-header">
        <button className="todo-back-btn" onClick={() => navigate("/")}>
          <BiArrowBack />
        </button>
        <h2>To-do Lists</h2>
        <ProfileDropdown />
      </header>

      <div className="todo-layout">
        {/* ── Sidebar ── */}
        <aside className="todo-sidebar">
          <button className="todo-new-btn" onClick={createList}>
            <BiPlus /> New List
          </button>

          <div className="todo-sidebar-tabs">
            <button
              className={`todo-sidebar-tab${tab === "active" ? " active" : ""}`}
              onClick={() => setTab("active")}
            >
              Active
            </button>
            <button
              className={`todo-sidebar-tab${tab === "archived" ? " active" : ""}`}
              onClick={() => setTab("archived")}
            >
              Archived
            </button>
          </div>

          <div className="todo-sidebar-search">
            <BiSearch className="todo-sidebar-search-icon" />
            <input
              className="todo-sidebar-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lists…"
            />
          </div>

          {loading ? (
            <p className="todo-sidebar-hint">Loading…</p>
          ) : (
            (() => {
              const visible = lists.filter(
                (l) =>
                  (tab === "archived" ? l.archived : !l.archived) &&
                  (l.title || "Untitled").toLowerCase().includes(search.toLowerCase())
              );
              return visible.length === 0 ? (
                <p className="todo-sidebar-hint">
                  {search ? "No results" : tab === "archived" ? "No archived lists" : "No lists yet"}
                </p>
              ) : (
                <ul className="todo-lists-nav">
                  {visible.map((list) => (
                    <li
                      key={list.id}
                      className={`todo-nav-item${list.id === selectedListId ? " active" : ""}`}
                      onClick={() => setSelectedListId(list.id)}
                    >
                      <span className="todo-nav-title">{list.title || "Untitled"}</span>
                      <span className="todo-nav-time">{formatRelativeTime(list.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </aside>

        {/* ── Editor ── */}
        <main className="todo-editor">
          {!selectedListId ? (
            <div className="todo-empty-state">
              <p>Select a list or create a new one</p>
            </div>
          ) : (() => {
            const currentList = lists.find((l) => l.id === selectedListId);
            const isArchived = !!currentList?.archived;
            return (
              <>
                {isArchived && (
                  <div className="todo-archived-banner">
                    <BiArchiveIn />
                    This list is archived — unarchive to make changes
                  </div>
                )}

                <div className="todo-editor-top">
                  {/* List icon */}
                  <div
                    className={`todo-list-icon-wrapper${isArchived ? " archived" : ""}`}
                    onClick={isArchived ? undefined : () => iconInputRef.current?.click()}
                    title={isArchived ? undefined : "Click to change icon"}
                  >
                    {currentList?.icon_url ? (
                      <img src={currentList.icon_url} className="todo-list-icon" alt="" />
                    ) : (
                      <div className="todo-list-icon-placeholder" />
                    )}
                    {!isArchived && (
                      <div className="todo-list-icon-edit-overlay">
                        <BiPencil />
                      </div>
                    )}
                  </div>
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    style={{ display: "none" }}
                    onChange={handleIconUpload}
                  />

                  <div className="todo-title-wrap">
                    <input
                      className={`todo-title-input${isArchived ? " archived" : ""}`}
                      value={title}
                      onChange={isArchived ? undefined : handleTitleChange}
                      readOnly={isArchived}
                      placeholder="Untitled List"
                      onFocus={isArchived ? undefined : () => { titleFocusedRef.current = true; emitActivity("editing", null, "title"); }}
                      onBlur={isArchived ? undefined : () => { titleFocusedRef.current = false; emitActivity("idle"); }}
                    />
                    {editingFields.get("title") && (
                      <span className="todo-field-peer-label" style={{ color: editingFields.get("title").color }}>
                        {editingFields.get("title").username} is editing…
                      </span>
                    )}
                  </div>

                  {presenceUsers.length > 0 && (
                    <div className="todo-presence-bar">
                      {presenceUsers.map((u) => (
                        <span
                          key={u.userId}
                          className="todo-presence-dot"
                          style={{ background: getUserColor(u.userId) }}
                          title={`${u.username} is here`}
                        >
                          {u.username[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}

                  {!isArchived && (
                    <button
                      className="todo-move-btn"
                      onClick={() => { setMoveTarget(""); setNewListName(""); setShowMoveModal(true); }}
                      title="Move incomplete items to another list"
                    >
                      <BiTransferAlt />
                    </button>
                  )}

                  <button
                    className={`todo-archive-btn${isArchived ? " unarchive" : ""}`}
                    onClick={handleArchiveToggle}
                    title={isArchived ? "Unarchive list" : "Archive list"}
                  >
                    {isArchived ? <BiArchiveOut /> : <BiArchiveIn />}
                  </button>

                  <button
                    className="todo-delete-list-btn"
                    onClick={() => handleDeleteList(selectedListId)}
                    title="Delete list"
                  >
                    <BiTrash />
                  </button>
                </div>

                <div className="todo-dates-row">
                  <label className="todo-date-label">
                    Start
                    {editingFields.get("start_date") && (
                      <span className="todo-date-peer-dot" style={{ background: editingFields.get("start_date").color }} title={`${editingFields.get("start_date").username} is editing…`} />
                    )}
                    <DatePicker
                      selected={startDate ? new Date(startDate + "T12:00:00") : null}
                      onChange={isArchived ? undefined : (date) => handleDateChange("start_date", date)}
                      dateFormat="MMM d, yyyy"
                      placeholderText="Pick a date"
                      disabled={isArchived}
                      calendarClassName="todo-calendar"
                      wrapperClassName="todo-datepicker-wrapper"
                      calendarContainer={startDateContainer}
                      onCalendarOpen={() => emitActivity("editing", null, "start_date")}
                      onCalendarClose={() => emitActivity("idle")}
                    />
                  </label>
                  <span className="todo-date-sep">→</span>
                  <label className="todo-date-label">
                    End
                    {editingFields.get("end_date") && (
                      <span className="todo-date-peer-dot" style={{ background: editingFields.get("end_date").color }} title={`${editingFields.get("end_date").username} is editing…`} />
                    )}
                    <DatePicker
                      selected={endDate ? new Date(endDate + "T12:00:00") : null}
                      onChange={isArchived ? undefined : (date) => handleDateChange("end_date", date)}
                      dateFormat="MMM d, yyyy"
                      placeholderText="Pick a date"
                      disabled={isArchived}
                      calendarClassName="todo-calendar"
                      wrapperClassName="todo-datepicker-wrapper"
                      calendarContainer={endDateContainer}
                      onCalendarOpen={() => emitActivity("editing", null, "end_date")}
                      onCalendarClose={() => emitActivity("idle")}
                    />
                  </label>
                </div>

                {itemsLoading ? (
                  <p className="todo-items-hint">Loading…</p>
                ) : (
                  <div className="todo-items-container">
                    {items.map((item) => (
                      <TodoItem
                        key={item.id}
                        item={item}
                        onToggle={handleToggleItem}
                        onDelete={handleDeleteItem}
                        onEditText={handleEditItemText}
                        onStartEditing={(id) => emitActivity("editing", id)}
                        onStopEditing={() => emitActivity("idle")}
                        editingUser={editingItems.get(item.id) || null}
                        flashColor={flashItems.get(item.id) || null}
                        readOnly={isArchived}
                      />
                    ))}

                    {!isArchived && (
                      <form className="todo-add-form" onSubmit={handleAddItem}>
                        <button type="submit" className="todo-add-icon" tabIndex={-1}>
                          <BiPlus />
                        </button>
                        <input
                          className="todo-add-input"
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          placeholder="Add an item…"
                        />
                      </form>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </main>
      </div>

      {showMoveModal && (
        <div className="todo-modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-modal-title">Move incomplete items</h3>
            <p className="todo-modal-desc">
              {items.filter((i) => !i.completed).length} item(s) will be moved to:
            </p>
            <select
              className="todo-modal-select"
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
            >
              <option value="">Pick a list…</option>
              {lists
                .filter((l) => l.id !== selectedListId)
                .map((l) => (
                  <option key={l.id} value={l.id}>{l.title || "Untitled"}</option>
                ))}
              <option value="new">+ Create new list</option>
            </select>
            {moveTarget === "new" && (
              <input
                className="todo-modal-input"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list name…"
                autoFocus
              />
            )}
            <div className="todo-modal-actions">
              <button className="todo-modal-cancel" onClick={() => setShowMoveModal(false)}>
                Cancel
              </button>
              <button
                className="todo-modal-confirm"
                onClick={handleMoveItems}
                disabled={!moveTarget || moving}
              >
                {moving ? "Moving…" : "Move items"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodoListPage;
