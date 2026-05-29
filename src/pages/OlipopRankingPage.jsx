import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BiArrowBack } from "react-icons/bi";
import { BsGripVertical, BsX } from "react-icons/bs";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "reactstrap";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./OlipopRankingPage.css";

const FLAVORS = [
  "Banana Cream",
  "Blackberry Vanilla",
  "Citrus Rush",
  "Classic Grape",
  "Classic Root Beer",
  "Cherry Cola",
  "Cherry Vanilla",
  "Cream Soda",
  "Crisp Apple",
  "Doctor Goodwin",
  "Ginger Ale",
  "Ginger Lemon",
  "Lemon Lime",
  "Orange Cream",
  "Orange Squeeze",
  "Peaches & Cream",
  "Pineapple Paradise",
  "Root Beer",
  "Strawberry Vanilla",
  "Shirley Temple",
  "Raspberry Sherbert",
  "Tropical Punch",
  "Vintage Cola",
  "Watermelon Lime",
];

const SortableItem = ({ flavor, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: flavor });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="ranking-item">
      <button className="drag-handle" {...attributes} {...listeners}>
        <BsGripVertical />
      </button>
      <span className="ranking-label">{flavor}</span>
      <button className="rank-btn remove-btn" onClick={() => onRemove(flavor)}>
        <BsX />
      </button>
    </li>
  );
};

const OlipopRankingPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [myRanking, setMyRanking] = useState([]);
  const [allRankings, setAllRankings] = useState([]);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [customFlavor, setCustomFlavor] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetch("/api/rankings/me", { credentials: "include" })
      .then((r) => r.json())
      .then(setMyRanking)
      .catch(() => {});

    fetch("/api/rankings", { credentials: "include" })
      .then((r) => r.json())
      .then(setAllRankings)
      .catch(() => {});
  }, []);

  const addFlavor = (flavor) => {
    if (myRanking.includes(flavor)) return;
    setMyRanking((prev) => [...prev, flavor]);
    setSaved(false);
  };

  const removeFlavor = (flavor) => {
    setMyRanking((prev) => prev.filter((f) => f !== flavor));
    setSaved(false);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMyRanking((prev) => {
        const oldIndex = prev.indexOf(active.id);
        const newIndex = prev.indexOf(over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setSaved(false);
    }
  };

  const addCustomFlavor = () => {
    const trimmed = customFlavor.trim();
    if (!trimmed || myRanking.includes(trimmed)) return;
    setMyRanking((prev) => [...prev, trimmed]);
    setCustomFlavor("");
    setSaved(false);
  };

  const saveRanking = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/rankings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flavors: myRanking }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const refreshed = await fetch("/api/rankings", {
        credentials: "include",
      });
      setAllRankings(await refreshed.json());
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const unranked = FLAVORS.filter((f) => !myRanking.includes(f));

  return (
    <div className="landing-page-container">
      <div className="messsage-board-header">
        <Button
          color="outline-secondary"
          size="sm"
          onClick={() => navigate("/")}
        >
          <BiArrowBack style={{ marginRight: 6 }} />
          Back
        </Button>
        <h2>Olipop Rankings</h2>
        <div className="header-user">
          <span className="header-username">{user?.username}</span>
          <Button color="outline-secondary" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}

      <div className="ranking-layout">
        <div className="my-ranking-panel">
          <div className="panel-heading">
            <h5>My Ranking</h5>
            <Button
              size="sm"
              color="primary"
              onClick={saveRanking}
              disabled={saved || saving}
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save"}
            </Button>
          </div>

          {myRanking.length === 0 ? (
            <p className="empty-hint">
              Add flavors below to start your ranking.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={myRanking}
                strategy={verticalListSortingStrategy}
              >
                <ol className="ranking-list">
                  {myRanking.map((flavor) => (
                    <SortableItem
                      key={flavor}
                      flavor={flavor}
                      onRemove={removeFlavor}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}

          <div className="flavor-picker">
            <p className="picker-label">Add a flavor:</p>
            <div className="custom-flavor-row">
              <Input
                bsSize="sm"
                placeholder="Can't find yours? Type it here…"
                value={customFlavor}
                onChange={(e) => setCustomFlavor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomFlavor()}
              />
              <Button
                size="sm"
                color="primary"
                onClick={addCustomFlavor}
                disabled={!customFlavor.trim()}
              >
                Add
              </Button>
            </div>
            <div className="flavor-chips">
              {unranked.map((flavor) => (
                <button
                  key={flavor}
                  className="flavor-chip"
                  onClick={() => addFlavor(flavor)}
                >
                  {flavor}
                </button>
              ))}
              {unranked.length === 0 && (
                <p className="empty-hint">You've ranked every flavor!</p>
              )}
            </div>
          </div>
        </div>

        <div className="all-rankings-panel">
          <h5>Everyone's Rankings</h5>
          {allRankings.length === 0 ? (
            <p className="empty-hint">No one has ranked yet — be the first!</p>
          ) : (
            <div className="all-rankings-grid">
              {allRankings.map(({ username, flavors }) => (
                <div
                  key={username}
                  className={`user-ranking-card ${username === user?.username ? "own-card" : ""}`}
                >
                  <p className="user-ranking-name">{username}</p>
                  <ol className="user-ranking-list">
                    {flavors.map((flavor) => (
                      <li key={flavor}>{flavor}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OlipopRankingPage;
