import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BiArrowBack } from "react-icons/bi";
import {
  BsHeart,
  BsHeartFill,
  BsCheckCircle,
  BsCheckCircleFill,
} from "react-icons/bs";
import { Button } from "reactstrap";
import { useAuth } from "../context/AuthContext";
import { useSwipe } from "../hooks/useSwipe";
import STAMPS from "../data/stamps.json";
import "./StampDetailPage.css";

const STAMP_MAP = Object.fromEntries(STAMPS.map((s) => [s.slug, s]));

const StampDetailPage = () => {
  const { slug } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const stamp = STAMP_MAP[slug];

  const [wishlisted, setWishlisted] = useState(false);
  const [collected, setCollected] = useState(false);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const [togglingCollection, setTogglingCollection] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetch("/api/stamps/wishlist", { credentials: "include" })
      .then((r) => r.json())
      .then((slugs) => setWishlisted(slugs.includes(slug)))
      .catch(() => {});
    fetch("/api/stamps/collection", { credentials: "include" })
      .then((r) => r.json())
      .then((slugs) => setCollected(slugs.includes(slug)))
      .catch(() => {});
    setActiveImg(0);
  }, [slug]);

  const toggleWishlist = async () => {
    if (togglingWishlist) return;
    setTogglingWishlist(true);
    const next = !wishlisted;
    setWishlisted(next);
    if (next) setCollected(false); // adding to wishlist evicts from collection
    try {
      await fetch(`/api/stamps/wishlist/${slug}`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
    } catch {
      setWishlisted(!next);
      if (next) setCollected(true);
    } finally {
      setTogglingWishlist(false);
    }
  };

  const toggleCollection = async () => {
    if (togglingCollection) return;
    setTogglingCollection(true);
    const next = !collected;
    setCollected(next);
    if (next) setWishlisted(false); // adding to collection evicts from wishlist
    try {
      await fetch(`/api/stamps/collection/${slug}`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
    } catch {
      setCollected(!next);
      if (next) setWishlisted(true);
    } finally {
      setTogglingCollection(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const images = stamp
    ? stamp.images?.length > 0 ? stamp.images : [stamp.img].filter(Boolean)
    : [];

  const prevImg = useCallback(
    () => setActiveImg((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );
  const nextImg = useCallback(
    () => setActiveImg((i) => (i + 1) % images.length),
    [images.length]
  );

  const swipeHandlers = useSwipe(nextImg, prevImg);

  useEffect(() => {
    if (images.length < 2) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") prevImg();
      if (e.key === "ArrowRight") nextImg();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, prevImg, nextImg]);

  if (!stamp) {
    return (
      <div className="stamp-detail-container">
        <div className="stamp-browse-header">
          <Button
            color="outline-secondary"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <BiArrowBack style={{ marginRight: 6 }} />
            Back
          </Button>
          <h2>Philately Central!</h2>
          <div />
        </div>
        <div className="stamp-empty">
          <p>This stamp doesn't exist.</p>
        </div>
      </div>
    );
  }

  const primaryDesigners =
    stamp.designers?.filter((d) =>
      /art director|stamp designer/i.test(d.role),
    ) ?? [];

  return (
    <div className="stamp-detail-container">
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

      <div className="stamp-detail-body">
        {/* Left: images */}
        <Button
          color="outline-secondary"
          size="sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() => navigate("/stamps", { state: { fromDetail: true } })}
        >
          <BiArrowBack style={{ marginRight: 6 }} />
          Back
        </Button>
        <div className="stamp-detail-images">
          <div className="stamp-detail-frame" {...swipeHandlers}>
            <img
              src={images[activeImg]}
              alt={stamp.name}
              className="stamp-detail-img"
            />
            {images.length > 1 && (
              <>
                <button className="stamp-img-arrow stamp-img-arrow--prev" onClick={prevImg} aria-label="Previous image">&#8249;</button>
                <button className="stamp-img-arrow stamp-img-arrow--next" onClick={nextImg} aria-label="Next image">&#8250;</button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="stamp-detail-thumbs">
              {images.map((src, i) => (
                <button
                  key={i}
                  className={`stamp-thumb ${i === activeImg ? "active" : ""}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img src={src} alt={`View ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: info */}
        <div className="stamp-detail-info">
          <div className="stamp-detail-name-row">
            <h1 className="stamp-detail-name">{stamp.name}</h1>
            <div className="stamp-detail-action-btns">
              <button
                className={`stamp-detail-action-btn stamp-detail-heart ${wishlisted ? "wishlisted" : ""}`}
                onClick={toggleWishlist}
                disabled={togglingWishlist}
                aria-label={
                  wishlisted ? "Remove from wishlist" : "Add to wishlist"
                }
              >
                {wishlisted ? <BsHeartFill /> : <BsHeart />}
                <span>{wishlisted ? "In Wishlist" : "Add to Wishlist"}</span>
              </button>
              <button
                className={`stamp-detail-action-btn stamp-detail-check ${collected ? "collected" : ""}`}
                onClick={toggleCollection}
                disabled={togglingCollection}
                aria-label={
                  collected ? "Remove from collection" : "Add to collection"
                }
              >
                {collected ? <BsCheckCircleFill /> : <BsCheckCircle />}
                <span>{collected ? "In Collection" : "Add to Collection"}</span>
              </button>
            </div>
          </div>

          {(stamp.series || stamp.topics?.length > 0) && (
            <div className="stamp-detail-tags">
              {stamp.series && (
                <span className="stamp-series-tag">{stamp.series}</span>
              )}
              {stamp.topics?.map((t) => (
                <span key={t} className="stamp-topic-tag">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="stamp-detail-meta-grid">
            {stamp.issued && (
              <div className="stamp-meta-item">
                <span className="stamp-meta-label">First Day of Issue</span>
                <span className="stamp-meta-value">{stamp.issued}</span>
              </div>
            )}
            {stamp.city && (
              <div className="stamp-meta-item">
                <span className="stamp-meta-label">Release City</span>
                <span className="stamp-meta-value">{stamp.city}</span>
              </div>
            )}
            {stamp.denomination && (
              <div className="stamp-meta-item">
                <span className="stamp-meta-label">Denomination</span>
                <span className="stamp-meta-value">{stamp.denomination}</span>
              </div>
            )}
            {primaryDesigners.length > 0 && (
              <div className="stamp-meta-item">
                <span className="stamp-meta-label">Designer</span>
                <span className="stamp-meta-value">
                  {primaryDesigners.map((d) => d.name).join(", ")}
                </span>
              </div>
            )}
            {stamp.designers
              ?.filter((d) => !/art director|stamp designer/i.test(d.role))
              .map((d) => (
                <div key={d.name + d.role} className="stamp-meta-item">
                  <span className="stamp-meta-label">{d.role}</span>
                  <span className="stamp-meta-value">{d.name}</span>
                </div>
              ))}
          </div>

          {stamp.description && (
            <div className="stamp-detail-description">
              <h3 className="stamp-desc-heading">About this Stamp</h3>
              <p>{stamp.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StampDetailPage;
