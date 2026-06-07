import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BsGripVertical, BsX, BsPlus } from "react-icons/bs";
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

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const CDN = "https://drinkolipop.com/cdn/shop/files";
const FLAVORS = [
  {
    name: "Banana Cream",
    img: `${CDN}/banana-cream-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Blackberry Vanilla",
    img: `${CDN}/blackberry-vanilla-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Cherry Cola",
    img: `${CDN}/cherry-cola-9g-olipop_gallery-main-image_new_asset.webp`,
  },
  {
    name: "Cherry Vanilla",
    img: `${CDN}/cherry-vanilla-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Citrus Rush",
    img: `${CDN}/citrus-rush-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Classic Grape",
    img: `${CDN}/classic-grape-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Classic Root Beer",
    img: `${CDN}/classic-root-beer-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Cream Soda",
    img: `${CDN}/cream-soda-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Crisp Apple",
    img: `${CDN}/crisp-apple-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Doctor Goodwin",
    img: `${CDN}/doctor-goodwin-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Ginger Ale",
    img: `${CDN}/ginger-ale-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Ginger Lemon",
    img: `${CDN}/ginger-lemon-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Lemon Lime",
    img: `${CDN}/lemon-lime-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Orange Cream",
    img: `${CDN}/orange-cream-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Orange Squeeze",
    img: `${CDN}/orange-squeeze-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Peaches & Cream",
    img: `${CDN}/peaches-and-cream-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Pineapple Paradise",
    img: `${CDN}/Pineapple-Paradise_cgi-main-image_072925.webp`,
  },
  {
    name: "Raspberry Sherbert",
    img: `${CDN}/raspberry-sherbert_omni-pdp_single.webp`,
  },
  {
    name: "Shirley Temple",
    img: `${CDN}/shirley-temple-6g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Strawberry Vanilla",
    img: `${CDN}/strawberry-vanilla-9g-olipop_gallery-main-image_new_asset.webp`,
  },
  {
    name: "Tropical Punch",
    img: `${CDN}/tropical-punch-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Vintage Cola",
    img: `${CDN}/vintage-cola-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
  {
    name: "Watermelon Lime",
    img: `${CDN}/watermelon-lime-9g-olipop_gallery-image_single-can_new_asset.webp`,
  },
];

const FLAVOR_IMG = Object.fromEntries(FLAVORS.map((f) => [f.name, f.img]));

const SortableItem = ({
  flavor,
  onRemove,
  onCanMouseEnter,
  onCanMouseLeave,
}) => {
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
      {FLAVOR_IMG[flavor] ? (
        <img
          src={FLAVOR_IMG[flavor]}
          alt={flavor}
          className="flavor-can-img"
          onMouseEnter={(e) => onCanMouseEnter(e, FLAVOR_IMG[flavor])}
          onMouseLeave={onCanMouseLeave}
        />
      ) : (
        <span className="flavor-can-placeholder">?</span>
      )}
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
  const [search, setSearch] = useState("");
  const [customFlavor, setCustomFlavor] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);

  const showTooltip = (e, img) => {
    clearTimeout(tooltipTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ img, x: rect.right + 12, y: rect.top + rect.height / 2 });
    }, 250);
  };

  const hideTooltip = () => {
    clearTimeout(tooltipTimer.current);
    setTooltip(null);
  };

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

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      setMyRanking((prev) =>
        arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)),
      );
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

  const query = search.toLowerCase();
  const filteredFlavors = FLAVORS.filter(
    (f) => !myRanking.includes(f.name) && f.name.toLowerCase().includes(query),
  );

  return (
    <div className="landing-page-container">
      <div className="messsage-board-header">
        <Button
          color="outline-secondary"
          size="sm"
          onClick={() => navigate("/")}
        >
          Home
        </Button>
        <h2>Olipop Rankings</h2>
        <div className="header-user">
          <span className="header-username">{cap(user?.username)}</span>
          <Button color="outline-secondary" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>

      {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}

      <div className="ranking-layout">
        {/* Left half: picker + my ranking combined */}
        <div className="combined-panel">
          <div className="combined-col">
            <h5 className="panel-title">All Flavors</h5>
            <Input
              bsSize="sm"
              placeholder="Search flavors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flavor-search"
            />
            <ul className="flavor-list">
              {filteredFlavors.map((f) => (
                <li
                  key={f.name}
                  className="flavor-list-item"
                  onClick={() => addFlavor(f.name)}
                >
                  <img
                    src={f.img}
                    alt={f.name}
                    className="flavor-can-img"
                    onMouseEnter={(e) => showTooltip(e, f.img)}
                    onMouseLeave={hideTooltip}
                  />
                  <span>{f.name}</span>
                  <BsPlus className="flavor-add-icon" />
                </li>
              ))}
              {filteredFlavors.length === 0 && (
                <li className="flavor-list-empty">No flavors match</li>
              )}
            </ul>
            <div className="custom-flavor-row">
              <Input
                bsSize="sm"
                placeholder="Add unlisted flavor…"
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
          </div>

          <div className="combined-divider" />

          <div className="combined-col">
            <div className="panel-heading">
              <h5 className="panel-title">Edit My Ranking</h5>
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
                Pick flavors from the list to start ranking.
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
                        onCanMouseEnter={showTooltip}
                        onCanMouseLeave={hideTooltip}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Right half: everyone's rankings */}
        <div className="all-rankings-panel">
          <h5 className="panel-title">Compare Rankings</h5>
          {allRankings.length === 0 ? (
            <p className="empty-hint">No one has ranked yet — be the first!</p>
          ) : (
            <div className="all-rankings-grid">
              {allRankings.slice(0, 2).map(({ username, flavors }) => (
                <div key={username} className="user-ranking-card">
                  <p className="user-ranking-name">{cap(username)}'s Ranking</p>

                  {/* Podium: top 3 */}
                  <div className="ranking-podium">
                    {/* 2nd */}
                    <div className="podium-slot">
                      {flavors[1] && (
                        <>
                          {FLAVOR_IMG[flavors[1]] ? (
                            <img
                              src={FLAVOR_IMG[flavors[1]]}
                              alt={flavors[1]}
                              className="podium-can"
                            />
                          ) : (
                            <span className="podium-can-unk">?</span>
                          )}
                          <div className="podium-block podium-block-2">
                            <span className="podium-num">2</span>
                          </div>
                          <p className="podium-label">{flavors[1]}</p>
                        </>
                      )}
                    </div>

                    {/* 1st */}
                    <div className="podium-slot podium-slot-1">
                      {flavors[0] && (
                        <>
                          <span className="podium-crown">👑</span>
                          {FLAVOR_IMG[flavors[0]] ? (
                            <img
                              src={FLAVOR_IMG[flavors[0]]}
                              alt={flavors[0]}
                              className="podium-can podium-can-1"
                            />
                          ) : (
                            <span className="podium-can-unk">?</span>
                          )}
                          <div className="podium-block podium-block-1">
                            <span className="podium-num">1</span>
                          </div>
                          <p className="podium-label">{flavors[0]}</p>
                        </>
                      )}
                    </div>

                    {/* 3rd */}
                    <div className="podium-slot">
                      {flavors[2] && (
                        <>
                          {FLAVOR_IMG[flavors[2]] ? (
                            <img
                              src={FLAVOR_IMG[flavors[2]]}
                              alt={flavors[2]}
                              className="podium-can"
                            />
                          ) : (
                            <span className="podium-can-unk">?</span>
                          )}
                          <div className="podium-block podium-block-3">
                            <span className="podium-num">3</span>
                          </div>
                          <p className="podium-label">{flavors[2]}</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Positions 4+ */}
                  {flavors.length > 3 && (
                    <ul className="ranking-rest-list">
                      {flavors.slice(3).map((flavor, i) => (
                        <li key={flavor} className="ranking-rest-item">
                          <span className="ranking-rest-num">{i + 4}.</span>
                          {FLAVOR_IMG[flavor] ? (
                            <img
                              src={FLAVOR_IMG[flavor]}
                              alt={flavor}
                              className="ranking-rest-can"
                            />
                          ) : (
                            <span className="ranking-rest-unk">?</span>
                          )}
                          <span className="ranking-rest-name">{flavor}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {tooltip && (
        <div
          className="flavor-can-tooltip-popup"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <img src={tooltip.img} alt="" />
        </div>
      )}
    </div>
  );
};

export default OlipopRankingPage;
