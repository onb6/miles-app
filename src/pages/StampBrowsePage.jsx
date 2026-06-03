import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BsHeart,
  BsHeartFill,
  BsCheckCircle,
  BsCheckCircleFill,
  BsX,
  BsSortDown,
  BsSortUp,
  BsPencil,
} from "react-icons/bs";
import { Button } from "reactstrap";
import Select from "react-select";
import { useAuth } from "../context/AuthContext";
import STAMPS from "../data/stamps.json";
import "./StampBrowsePage.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STATE_NAMES = {
  AK: "Alaska",
  AL: "Alabama",
  AR: "Arkansas",
  AS: "American Samoa",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "Washington, D.C.",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  GU: "Guam",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
};

const NORMALIZE_STATE = {
  Florida: "FL",
  Ohio: "OH",
  Guam: "GU",
  "Washington DC": "DC",
};

function getState(city) {
  const raw = city?.split(", ").at(-1) ?? null;
  if (!raw) return null;
  const stripped = raw.replace(/\s+\d{5}$/, "").trim();
  return NORMALIZE_STATE[stripped] ?? stripped;
}

// Derive available filter options from actual data
const ALL_YEARS = [...new Set(STAMPS.map((s) => s.year).filter(Boolean))].sort(
  (a, b) => b - a,
);
const ALL_TOPICS = [...new Set(STAMPS.flatMap((s) => s.topics))].sort();
const ALL_MONTHS = MONTHS.filter((m) =>
  STAMPS.some((s) => s.issued?.startsWith(m)),
);
const ALL_STATES = [
  ...new Set(STAMPS.map((s) => getState(s.city)).filter(Boolean)),
].sort();

// react-select option arrays
const YEAR_OPTIONS = ALL_YEARS.map((y) => ({ value: y, label: String(y) }));
const MONTH_OPTIONS = ALL_MONTHS.map((m) => ({ value: m, label: m }));
const TOPIC_OPTIONS = ALL_TOPICS.map((t) => ({ value: t, label: t }));
const STATE_OPTIONS = ALL_STATES.map((s) => ({
  value: s,
  label: STATE_NAMES[s] ?? s,
}));

const SELECT_STYLES = {
  control: (base, { isFocused }) => ({
    ...base,
    minHeight: 36,
    borderColor: isFocused ? "#286e84" : "rgba(40,110,132,0.22)",
    boxShadow: isFocused ? "0 0 0 2px rgba(40,110,132,0.12)" : "none",
    borderRadius: 8,
    fontSize: "0.8rem",
    cursor: "pointer",
    "&:hover": { borderColor: "#286e84" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 8px",
    gap: 3,
    flexWrap: "wrap",
  }),
  input: (base) => ({
    ...base,
    fontSize: "0.8rem",
    color: "#1a3a44",
    margin: 0,
    padding: 0,
  }),
  placeholder: (base) => ({ ...base, color: "#adb5bd", fontSize: "0.8rem" }),
  option: (base, { isSelected, isFocused }) => ({
    ...base,
    fontSize: "0.8rem",
    backgroundColor: isSelected
      ? "#286e84"
      : isFocused
        ? "rgba(40,110,132,0.08)"
        : "white",
    color: isSelected ? "white" : "#1a3a44",
    cursor: "pointer",
    borderRadius: 6,
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "rgba(40,110,132,0.1)",
    borderRadius: 20,
    margin: "2px 2px",
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#286e84",
    fontSize: "0.7rem",
    fontWeight: 600,
    padding: "1px 4px 1px 8px",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#286e84",
    borderRadius: "0 20px 20px 0",
    paddingRight: 6,
    "&:hover": { backgroundColor: "#e05d7a", color: "white" },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    border: "1px solid rgba(40,110,132,0.15)",
    zIndex: 200,
  }),
  menuList: (base) => ({ ...base, padding: 4 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#adb5bd",
    padding: "0 8px",
    "&:hover": { color: "#286e84" },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#adb5bd",
    padding: "0 4px",
    "&:hover": { color: "#e05d7a" },
  }),
};

const StampBrowsePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [wishlist, setWishlist] = useState(new Set());
  const [collection, setCollection] = useState(new Set());
  const [view, setView] = useState("all");
  const [togglingWishlist, setTogglingWishlist] = useState(null);
  const [togglingCollection, setTogglingCollection] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberWishlist, setMemberWishlist] = useState(new Set());
  const [memberCollection, setMemberCollection] = useState(new Set());
  const [goals, setGoals] = useState([]);
  const [memberGoals, setMemberGoals] = useState([]);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalYears, setNewGoalYears] = useState([]);
  const [newGoalMonths, setNewGoalMonths] = useState([]);
  const [newGoalTopics, setNewGoalTopics] = useState([]);
  const [newGoalStates, setNewGoalStates] = useState([]);
  const [addingGoal, setAddingGoal] = useState(false);

  // Filters — arrays for multi-select
  const [search, setSearch] = useState("");
  const [filterYears, setFilterYears] = useState([]);
  const [filterMonths, setFilterMonths] = useState([]);
  const [filterTopics, setFilterTopics] = useState([]);
  const [filterStates, setFilterStates] = useState([]);
  const [sortDir, setSortDir] = useState("desc");
  const [showScrollTop, setShowScrollTop] = useState(false);

  const scrollRestoreRef = useRef(null);

  useEffect(() => {
    const onScroll = () =>
      setShowScrollTop(window.scrollY > window.innerHeight);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Restore filter state + scroll position when returning from a detail page
  useEffect(() => {
    if (!location.state?.fromDetail) return;
    const raw = sessionStorage.getItem("stampBrowseState");
    if (!raw) return;
    sessionStorage.removeItem("stampBrowseState");
    try {
      const saved = JSON.parse(raw);
      setSearch(saved.search ?? "");
      setFilterYears(saved.filterYears ?? []);
      setFilterMonths(saved.filterMonths ?? []);
      setFilterTopics(saved.filterTopics ?? []);
      setFilterStates(saved.filterStates ?? []);
      setSortDir(saved.sortDir ?? "desc");
      setView(saved.view ?? "all");
      scrollRestoreRef.current = saved.scrollY ?? 0;
    } catch {}
  }, [location.state?.fromDetail]);

  // After the restored filters cause a re-render, scroll to the saved position
  useEffect(() => {
    if (scrollRestoreRef.current === null) return;
    const y = scrollRestoreRef.current;
    scrollRestoreRef.current = null;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.scrollTo(0, y)),
    );
  });

  useEffect(() => {
    fetch("/api/stamps/wishlist", { credentials: "include" })
      .then((r) => r.json())
      .then((slugs) => setWishlist(new Set(slugs)))
      .catch(() => {});
    fetch("/api/stamps/collection", { credentials: "include" })
      .then((r) => r.json())
      .then((slugs) => setCollection(new Set(slugs)))
      .catch(() => {});
    fetch("/api/stamps/users", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMembers(data))
      .catch(() => {});
    fetch("/api/stamps/goals", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setGoals(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMember) {
      setMemberWishlist(new Set());
      setMemberCollection(new Set());
      setMemberGoals([]);
      return;
    }
    Promise.all([
      fetch(`/api/stamps/user/${encodeURIComponent(selectedMember)}/wishlist`, {
        credentials: "include",
      }),
      fetch(
        `/api/stamps/user/${encodeURIComponent(selectedMember)}/collection`,
        { credentials: "include" },
      ),
      fetch(`/api/stamps/user/${encodeURIComponent(selectedMember)}/goals`, {
        credentials: "include",
      }),
    ])
      .then(async ([wRes, cRes, gRes]) => {
        const [wSlugs, cSlugs, gData] = await Promise.all([
          wRes.json(),
          cRes.json(),
          gRes.json(),
        ]);
        setMemberWishlist(new Set(wSlugs));
        setMemberCollection(new Set(cSlugs));
        setMemberGoals(gData);
      })
      .catch(() => {});
  }, [selectedMember]);

  const toggleWishlist = useCallback(
    async (e, slug) => {
      e.stopPropagation();
      if (togglingWishlist === slug) return;
      setTogglingWishlist(slug);
      const inList = wishlist.has(slug);
      setWishlist((prev) => {
        const next = new Set(prev);
        inList ? next.delete(slug) : next.add(slug);
        return next;
      });
      if (!inList)
        setCollection((prev) => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      try {
        await fetch(`/api/stamps/wishlist/${slug}`, {
          method: inList ? "DELETE" : "POST",
          credentials: "include",
        });
      } catch {
        setWishlist((prev) => {
          const next = new Set(prev);
          inList ? next.add(slug) : next.delete(slug);
          return next;
        });
        if (!inList)
          setCollection((prev) => {
            const next = new Set(prev);
            next.add(slug);
            return next;
          });
      } finally {
        setTogglingWishlist(null);
      }
    },
    [wishlist, togglingWishlist],
  );

  const toggleCollection = useCallback(
    async (e, slug) => {
      e.stopPropagation();
      if (togglingCollection === slug) return;
      setTogglingCollection(slug);
      const inList = collection.has(slug);
      setCollection((prev) => {
        const next = new Set(prev);
        inList ? next.delete(slug) : next.add(slug);
        return next;
      });
      if (!inList)
        setWishlist((prev) => {
          const next = new Set(prev);
          next.delete(slug);
          return next;
        });
      try {
        await fetch(`/api/stamps/collection/${slug}`, {
          method: inList ? "DELETE" : "POST",
          credentials: "include",
        });
      } catch {
        setCollection((prev) => {
          const next = new Set(prev);
          inList ? next.add(slug) : next.delete(slug);
          return next;
        });
        if (!inList)
          setWishlist((prev) => {
            const next = new Set(prev);
            next.add(slug);
            return next;
          });
      } finally {
        setTogglingCollection(null);
      }
    },
    [collection, togglingCollection],
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSelectMember = (username) => {
    if (selectedMember === username) {
      setSelectedMember(null);
      setView("all");
    } else {
      setSelectedMember(username);
    }
  };

  const addGoal = async () => {
    if (!newGoalTitle.trim() || addingGoal) return;
    setAddingGoal(true);
    const filters = [
      ...newGoalYears.map((v) => ({
        filter_type: "year",
        filter_value: String(v),
      })),
      ...newGoalMonths.map((v) => ({ filter_type: "month", filter_value: v })),
      ...newGoalTopics.map((v) => ({ filter_type: "topic", filter_value: v })),
      ...newGoalStates.map((v) => ({ filter_type: "state", filter_value: v })),
    ];
    try {
      const res = await fetch("/api/stamps/goals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newGoalTitle.trim(), filters }),
      });
      const goal = await res.json();
      setGoals((prev) => [...prev, goal]);
      setNewGoalTitle("");
      setNewGoalYears([]);
      setNewGoalMonths([]);
      setNewGoalTopics([]);
      setNewGoalStates([]);
    } catch {
    } finally {
      setAddingGoal(false);
    }
  };

  const toggleGoalComplete = async (id) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
    );
    try {
      await fetch(`/api/stamps/goals/${id}`, {
        method: "PATCH",
        credentials: "include",
      });
    } catch {
      setGoals((prev) =>
        prev.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
      );
    }
  };

  const deleteGoal = async (id) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await fetch(`/api/stamps/goals/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {}
  };

  const editGoal = async (id, title, filters) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, title, filters } : g)),
    );
    try {
      await fetch(`/api/stamps/goals/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, filters }),
      });
    } catch {}
  };

  const handleStampClick = useCallback(
    (slug) => {
      sessionStorage.setItem(
        "stampBrowseState",
        JSON.stringify({
          search,
          filterYears,
          filterMonths,
          filterTopics,
          filterStates,
          sortDir,
          view,
          scrollY: window.scrollY,
        }),
      );
      navigate(`/stamps/${slug}`);
    },
    [
      search,
      filterYears,
      filterMonths,
      filterTopics,
      filterStates,
      sortDir,
      view,
      navigate,
    ],
  );

  const clearFilters = () => {
    setSearch("");
    setFilterYears([]);
    setFilterMonths([]);
    setFilterTopics([]);
    setFilterStates([]);
  };
  const hasFilters = !!(
    search ||
    filterYears.length ||
    filterMonths.length ||
    filterTopics.length ||
    filterStates.length
  );

  const activeWishlist = selectedMember ? memberWishlist : wishlist;
  const activeCollection = selectedMember ? memberCollection : collection;
  const activeGoals = selectedMember ? memberGoals : goals;

  const displayed = useMemo(() => {
    let base =
      view === "wishlist"
        ? STAMPS.filter((s) => activeWishlist.has(s.slug))
        : view === "collection"
          ? STAMPS.filter((s) => activeCollection.has(s.slug))
          : STAMPS;

    if (search)
      base = base.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      );
    if (filterYears.length)
      base = base.filter((s) => filterYears.includes(s.year));
    if (filterMonths.length)
      base = base.filter((s) =>
        filterMonths.some((m) => s.issued?.startsWith(m)),
      );
    if (filterTopics.length)
      base = base.filter((s) =>
        filterTopics.some((t) => s.topics?.includes(t)),
      );
    if (filterStates.length)
      base = base.filter((s) => filterStates.includes(getState(s.city)));

    const TBA = new Date("9999-12-31");
    return [...base].sort((a, b) => {
      const da = a.issued ? new Date(a.issued) : TBA;
      const db = b.issued ? new Date(b.issued) : TBA;
      return sortDir === "asc" ? da - db : db - da;
    });
  }, [
    view,
    search,
    filterYears,
    filterMonths,
    filterTopics,
    filterStates,
    sortDir,
    activeWishlist,
    activeCollection,
  ]);

  const baseCount =
    view === "wishlist"
      ? activeWishlist.size
      : view === "collection"
        ? activeCollection.size
        : STAMPS.length;

  const emptyMessages = {
    wishlist: selectedMember
      ? `${selectedMember} hasn't added any stamps to their wishlist yet.`
      : "No stamps in your wishlist yet.",
    collection: selectedMember
      ? `${selectedMember} hasn't added any stamps to their collection yet.`
      : "No stamps in your collection yet.",
  };

  return (
    <div className="stamp-browse-container">
      <div className="stamp-browse-header">
        <Button
          color="outline-secondary"
          size="sm"
          onClick={() => navigate("/")}
        >
          Home
        </Button>
        <h2>Philately Central!</h2>
        <div className="header-user">
          <span className="header-username">{user?.username}</span>
          <Button color="outline-secondary" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      <div className="stamp-browse-controls">
        <div className="stamp-top-controls">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === "all" ? "active" : ""}`}
              onClick={() => setView("all")}
            >
              All Stamps<span className="toggle-count">{STAMPS.length}</span>
            </button>
            <button
              className={`toggle-btn toggle-btn--wishlist ${view === "wishlist" ? "active" : ""}`}
              onClick={() => setView("wishlist")}
            >
              {selectedMember ? `${selectedMember}'s Wishlist` : "My Wishlist"}
              <span className="toggle-count">{activeWishlist.size}</span>
            </button>
            <button
              className={`toggle-btn toggle-btn--collection ${view === "collection" ? "active" : ""}`}
              onClick={() => setView("collection")}
            >
              {selectedMember
                ? `${selectedMember}'s Collection`
                : "My Collection"}
              <span className="toggle-count">{activeCollection.size}</span>
            </button>
            <button
              className={`toggle-btn toggle-btn--goals ${view === "goals" ? "active" : ""}`}
              onClick={() => setView("goals")}
            >
              {selectedMember ? `${selectedMember}'s Goals` : "My Goals"}
              <span className="toggle-count">{activeGoals.length}</span>
            </button>
          </div>

          <div className="stamp-members-divider" />

          <span className="stamp-members-label">View by user:</span>

          <button
            className={`stamp-member-btn${!selectedMember ? " active" : ""}`}
            onClick={() => setSelectedMember(null)}
          >
            Me
          </button>
          {members.map((m) => (
            <button
              key={m.username}
              className={`stamp-member-btn${selectedMember === m.username ? " active" : ""}`}
              onClick={() => handleSelectMember(m.username)}
            >
              {m.username}
            </button>
          ))}
        </div>

        {view !== "goals" && (
          <div className="stamp-filters">
            <div className="stamp-search-wrap">
              <input
                className="stamp-search"
                type="search"
                placeholder="Search stamps…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="stamp-select-wrap">
              <Select
                isMulti
                isSearchable
                options={YEAR_OPTIONS}
                value={YEAR_OPTIONS.filter((o) =>
                  filterYears.includes(o.value),
                )}
                onChange={(sel) => setFilterYears(sel.map((o) => o.value))}
                placeholder="Year"
                styles={SELECT_STYLES}
                classNamePrefix="rs"
              />
            </div>

            <div className="stamp-select-wrap">
              <Select
                isMulti
                isSearchable
                options={MONTH_OPTIONS}
                value={MONTH_OPTIONS.filter((o) =>
                  filterMonths.includes(o.value),
                )}
                onChange={(sel) => setFilterMonths(sel.map((o) => o.value))}
                placeholder="Month"
                styles={SELECT_STYLES}
                classNamePrefix="rs"
              />
            </div>

            <div className="stamp-select-wrap stamp-select-wrap--wide">
              <Select
                isMulti
                isSearchable
                options={TOPIC_OPTIONS}
                value={TOPIC_OPTIONS.filter((o) =>
                  filterTopics.includes(o.value),
                )}
                onChange={(sel) => setFilterTopics(sel.map((o) => o.value))}
                placeholder="Category"
                styles={SELECT_STYLES}
                classNamePrefix="rs"
              />
            </div>

            <div className="stamp-select-wrap stamp-select-wrap--wide">
              <Select
                isMulti
                isSearchable
                options={STATE_OPTIONS}
                value={STATE_OPTIONS.filter((o) =>
                  filterStates.includes(o.value),
                )}
                onChange={(sel) => setFilterStates(sel.map((o) => o.value))}
                placeholder="State"
                styles={SELECT_STYLES}
                classNamePrefix="rs"
              />
            </div>

            {hasFilters && (
              <button
                className="stamp-clear-btn"
                onClick={clearFilters}
                title="Clear filters"
              >
                <BsX /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {view !== "goals" && (
        <div className="stamp-results-bar">
          <span>
            {hasFilters ? (
              <>
                {displayed.length} of {baseCount} stamp
                {baseCount !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                {baseCount} stamp{baseCount !== 1 ? "s" : ""}
              </>
            )}
          </span>
          <button
            className="stamp-sort-btn"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            title={sortDir === "asc" ? "Oldest first" : "Newest first"}
          >
            {sortDir === "desc" ? <BsSortDown /> : <BsSortUp />}
            {sortDir === "desc" ? "Newest first" : "Oldest first"}
          </button>
        </div>
      )}

      {view === "goals" ? (
        <GoalsView
          goals={activeGoals}
          isOwner={!selectedMember}
          onToggleComplete={toggleGoalComplete}
          onDelete={deleteGoal}
          newGoalTitle={newGoalTitle}
          setNewGoalTitle={setNewGoalTitle}
          newGoalYears={newGoalYears}
          setNewGoalYears={setNewGoalYears}
          newGoalMonths={newGoalMonths}
          setNewGoalMonths={setNewGoalMonths}
          newGoalTopics={newGoalTopics}
          setNewGoalTopics={setNewGoalTopics}
          newGoalStates={newGoalStates}
          setNewGoalStates={setNewGoalStates}
          onAddGoal={addGoal}
          addingGoal={addingGoal}
          onEdit={editGoal}
        />
      ) : displayed.length === 0 ? (
        <div className="stamp-empty">
          {hasFilters ? (
            <>
              <p>No stamps match your filters.</p>
              <button className="link-btn" onClick={clearFilters}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p>{emptyMessages[view] ?? "No stamps found."}</p>
              {view !== "all" && (
                <button className="link-btn" onClick={() => setView("all")}>
                  Browse all stamps
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="stamp-grid">
          {displayed.map((stamp) => (
            <StampCard
              key={stamp.slug}
              stamp={stamp}
              wishlisted={wishlist.has(stamp.slug)}
              collected={collection.has(stamp.slug)}
              togglingWishlist={togglingWishlist === stamp.slug}
              togglingCollection={togglingCollection === stamp.slug}
              onToggleWishlist={toggleWishlist}
              onToggleCollection={toggleCollection}
              onClick={() => handleStampClick(stamp.slug)}
            />
          ))}
        </div>
      )}

      {showScrollTop && (
        <button
          className="stamp-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}
    </div>
  );
};

const StampCard = ({
  stamp,
  wishlisted,
  collected,
  togglingWishlist,
  togglingCollection,
  onToggleWishlist,
  onToggleCollection,
  onClick,
}) => (
  <div
    className="stamp-card"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === "Enter" && onClick()}
  >
    <div className="stamp-frame">
      <div className="stamp-img-wrap">
        <img
          src={stamp.img}
          alt={stamp.name}
          className="stamp-img"
          loading="lazy"
        />
      </div>
    </div>
    <div className="stamp-card-body">
      <p className="stamp-card-name">{stamp.name}</p>
      <p className="stamp-card-meta">
        {stamp.issued || "Date TBA"}
        {stamp.city && <> · {stamp.city}</>}
      </p>
      {stamp.topics?.length > 0 && (
        <div className="stamp-card-topics">
          {stamp.topics.slice(0, 2).map((t) => (
            <span key={t} className="stamp-topic-tag">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
    <div className="stamp-card-actions">
      <button
        className={`stamp-action-btn stamp-heart-btn ${wishlisted ? "wishlisted" : ""}`}
        onClick={(e) => onToggleWishlist(e, stamp.slug)}
        disabled={togglingWishlist}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
      >
        {wishlisted ? <BsHeartFill /> : <BsHeart />}
      </button>
      <button
        className={`stamp-action-btn stamp-check-btn ${collected ? "collected" : ""}`}
        onClick={(e) => onToggleCollection(e, stamp.slug)}
        disabled={togglingCollection}
        aria-label={collected ? "Remove from collection" : "Add to collection"}
        title={collected ? "Remove from collection" : "Add to collection"}
      >
        {collected ? <BsCheckCircleFill /> : <BsCheckCircle />}
      </button>
    </div>
  </div>
);

function getFilterLabel({ filter_type, filter_value }) {
  if (filter_type === "state") return STATE_NAMES[filter_value] ?? filter_value;
  return filter_value;
}

const GoalsView = ({
  goals,
  isOwner,
  onToggleComplete,
  onDelete,
  onEdit,
  newGoalTitle,
  setNewGoalTitle,
  newGoalYears,
  setNewGoalYears,
  newGoalMonths,
  setNewGoalMonths,
  newGoalTopics,
  setNewGoalTopics,
  newGoalStates,
  setNewGoalStates,
  onAddGoal,
  addingGoal,
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editYears, setEditYears] = useState([]);
  const [editMonths, setEditMonths] = useState([]);
  const [editTopics, setEditTopics] = useState([]);
  const [editStates, setEditStates] = useState([]);

  const startEdit = (goal) => {
    setEditingId(goal.id);
    setEditTitle(goal.title);
    setEditYears(
      goal.filters
        .filter((f) => f.filter_type === "year")
        .map((f) => Number(f.filter_value)),
    );
    setEditMonths(
      goal.filters
        .filter((f) => f.filter_type === "month")
        .map((f) => f.filter_value),
    );
    setEditTopics(
      goal.filters
        .filter((f) => f.filter_type === "topic")
        .map((f) => f.filter_value),
    );
    setEditStates(
      goal.filters
        .filter((f) => f.filter_type === "state")
        .map((f) => f.filter_value),
    );
  };

  const saveEdit = () => {
    if (!editTitle.trim()) return;
    const filters = [
      ...editYears.map((v) => ({
        filter_type: "year",
        filter_value: String(v),
      })),
      ...editMonths.map((v) => ({ filter_type: "month", filter_value: v })),
      ...editTopics.map((v) => ({ filter_type: "topic", filter_value: v })),
      ...editStates.map((v) => ({ filter_type: "state", filter_value: v })),
    ];
    onEdit(editingId, editTitle.trim(), filters);
    setEditingId(null);
  };

  return (
    <div className="goals-container">
      {isOwner && (
        <div className="goal-add-form">
          <input
            className="goal-title-input"
            type="text"
            placeholder="Add a goal…"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddGoal()}
          />
          <div className="goal-add-filters">
            <Select
              isMulti
              isSearchable
              options={YEAR_OPTIONS}
              value={YEAR_OPTIONS.filter((o) => newGoalYears.includes(o.value))}
              onChange={(sel) => setNewGoalYears(sel.map((o) => o.value))}
              placeholder="Year"
              styles={SELECT_STYLES}
              classNamePrefix="rs"
            />
            <Select
              isMulti
              isSearchable
              options={MONTH_OPTIONS}
              value={MONTH_OPTIONS.filter((o) =>
                newGoalMonths.includes(o.value),
              )}
              onChange={(sel) => setNewGoalMonths(sel.map((o) => o.value))}
              placeholder="Month"
              styles={SELECT_STYLES}
              classNamePrefix="rs"
            />
            <Select
              isMulti
              isSearchable
              options={TOPIC_OPTIONS}
              value={TOPIC_OPTIONS.filter((o) =>
                newGoalTopics.includes(o.value),
              )}
              onChange={(sel) => setNewGoalTopics(sel.map((o) => o.value))}
              placeholder="Category"
              styles={SELECT_STYLES}
              classNamePrefix="rs"
            />
            <Select
              isMulti
              isSearchable
              options={STATE_OPTIONS}
              value={STATE_OPTIONS.filter((o) =>
                newGoalStates.includes(o.value),
              )}
              onChange={(sel) => setNewGoalStates(sel.map((o) => o.value))}
              placeholder="State"
              styles={SELECT_STYLES}
              classNamePrefix="rs"
            />
          </div>
          <button
            className="goal-add-btn"
            onClick={onAddGoal}
            disabled={addingGoal || !newGoalTitle.trim()}
          >
            Add Goal
          </button>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="stamp-empty">
          <p>{isOwner ? "No goals yet. Add one above!" : "No goals yet."}</p>
        </div>
      ) : (
        <div className="goals-list">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className={`goal-item${goal.completed && editingId !== goal.id ? " goal-item--done" : ""}`}
            >
              {editingId === goal.id ? (
                <div className="goal-edit-form">
                  <input
                    className="goal-title-input"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                  <div className="goal-add-filters">
                    <Select
                      isMulti
                      isSearchable
                      options={YEAR_OPTIONS}
                      value={YEAR_OPTIONS.filter((o) =>
                        editYears.includes(o.value),
                      )}
                      onChange={(sel) => setEditYears(sel.map((o) => o.value))}
                      placeholder="Year"
                      styles={SELECT_STYLES}
                      classNamePrefix="rs"
                    />
                    <Select
                      isMulti
                      isSearchable
                      options={MONTH_OPTIONS}
                      value={MONTH_OPTIONS.filter((o) =>
                        editMonths.includes(o.value),
                      )}
                      onChange={(sel) => setEditMonths(sel.map((o) => o.value))}
                      placeholder="Month"
                      styles={SELECT_STYLES}
                      classNamePrefix="rs"
                    />
                    <Select
                      isMulti
                      isSearchable
                      options={TOPIC_OPTIONS}
                      value={TOPIC_OPTIONS.filter((o) =>
                        editTopics.includes(o.value),
                      )}
                      onChange={(sel) => setEditTopics(sel.map((o) => o.value))}
                      placeholder="Category"
                      styles={SELECT_STYLES}
                      classNamePrefix="rs"
                    />
                    <Select
                      isMulti
                      isSearchable
                      options={STATE_OPTIONS}
                      value={STATE_OPTIONS.filter((o) =>
                        editStates.includes(o.value),
                      )}
                      onChange={(sel) => setEditStates(sel.map((o) => o.value))}
                      placeholder="State"
                      styles={SELECT_STYLES}
                      classNamePrefix="rs"
                    />
                  </div>
                  <div className="goal-edit-actions">
                    <button
                      className="goal-add-btn"
                      onClick={saveEdit}
                      disabled={!editTitle.trim()}
                    >
                      Save
                    </button>
                    <button
                      className="goal-cancel-btn"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {isOwner ? (
                    <input
                      type="checkbox"
                      className="goal-checkbox"
                      checked={goal.completed}
                      onChange={() => onToggleComplete(goal.id)}
                    />
                  ) : (
                    <span
                      className={`goal-status-dot${goal.completed ? " goal-status-dot--done" : ""}`}
                    />
                  )}
                  <div className="goal-body">
                    <span className="goal-title">{goal.title}</span>
                    {goal.filters.length > 0 && (
                      <div className="goal-filter-tags">
                        {goal.filters.map((f, i) => (
                          <span
                            key={i}
                            className={`goal-filter-tag goal-filter-tag--${f.filter_type}`}
                          >
                            {getFilterLabel(f)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <div className="goal-item-actions">
                      <button
                        className="goal-edit-btn"
                        onClick={() => startEdit(goal)}
                        aria-label="Edit goal"
                      >
                        <BsPencil />
                      </button>
                      <button
                        className="goal-delete-btn"
                        onClick={() => onDelete(goal.id)}
                        aria-label="Delete goal"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StampBrowsePage;
