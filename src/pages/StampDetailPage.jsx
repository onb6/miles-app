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
import ProfileDropdown from "../components/ProfileDropdown";
import { useSwipe } from "../hooks/useSwipe";
import STAMPS from "../data/stamps.json";
import "./StampDetailPage.css";

const STAMP_MAP = Object.fromEntries(STAMPS.map((s) => [s.slug, s]));

const StampDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const stamp = STAMP_MAP[slug];

  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistAddedAt, setWishlistAddedAt] = useState(null);
  const [collected, setCollected] = useState(false);
  const [collectionAddedAt, setCollectionAddedAt] = useState(null);
  const [togglingWishlist, setTogglingWishlist] = useState(false);
  const [togglingCollection, setTogglingCollection] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIdx, setModalIdx] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetch("/api/stamps/wishlist", { credentials: "include" })
      .then((r) => r.json())
      .then((items) => {
        const match = items.find((i) => i.slug === slug);
        setWishlisted(!!match);
        setWishlistAddedAt(match?.added_at ?? null);
      })
      .catch(() => {});
    fetch("/api/stamps/collection", { credentials: "include" })
      .then((r) => r.json())
      .then((items) => {
        const match = items.find((i) => i.slug === slug);
        setCollected(!!match);
        setCollectionAddedAt(match?.added_at ?? null);
      })
      .catch(() => {});
    setActiveImg(0);
  }, [slug]);

  const toggleWishlist = async () => {
    if (togglingWishlist) return;
    setTogglingWishlist(true);
    const next = !wishlisted;
    setWishlisted(next);
    setWishlistAddedAt(next ? new Date().toISOString() : null);
    if (next) {
      setCollected(false);
      setCollectionAddedAt(null);
    }
    try {
      await fetch(`/api/stamps/wishlist/${slug}`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
    } catch {
      setWishlisted(!next);
      setWishlistAddedAt(next ? null : new Date().toISOString());
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
    setCollectionAddedAt(next ? new Date().toISOString() : null);
    if (next) {
      setWishlisted(false);
      setWishlistAddedAt(null);
    }
    try {
      await fetch(`/api/stamps/collection/${slug}`, {
        method: next ? "POST" : "DELETE",
        credentials: "include",
      });
    } catch {
      setCollected(!next);
      setCollectionAddedAt(next ? null : new Date().toISOString());
      if (next) setWishlisted(true);
    } finally {
      setTogglingCollection(false);
    }
  };

  const images = stamp
    ? stamp.images?.length > 0
      ? stamp.images
      : [stamp.img].filter(Boolean)
    : [];

  const allImages = stamp
    ? [
        ...images,
        ...(stamp.sheet_img && !images.includes(stamp.sheet_img)
          ? [stamp.sheet_img]
          : []),
      ]
    : [];

  const prevImg = useCallback(
    () => setActiveImg((i) => (i - 1 + images.length) % images.length),
    [images.length],
  );
  const nextImg = useCallback(
    () => setActiveImg((i) => (i + 1) % images.length),
    [images.length],
  );
  const openModal = useCallback((idx) => {
    setModalIdx(idx);
    setModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setModalOpen(false), []);
  const modalPrev = useCallback(
    () => setModalIdx((i) => (i - 1 + allImages.length) % allImages.length),
    [allImages.length],
  );
  const modalNext = useCallback(
    () => setModalIdx((i) => (i + 1) % allImages.length),
    [allImages.length],
  );

  const swipeHandlers = useSwipe(nextImg, prevImg);

  useEffect(() => {
    if (images.length < 2 || modalOpen) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") prevImg();
      if (e.key === "ArrowRight") nextImg();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, prevImg, nextImg, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") modalPrev();
      if (e.key === "ArrowRight") modalNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalOpen, closeModal, modalPrev, modalNext]);

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
          <h2>Stamp Collecting</h2>
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

  const otherDesignerGroups = Object.entries(
    (stamp.designers ?? [])
      .filter((d) => !/art director|stamp designer/i.test(d.role))
      .reduce((acc, d) => {
        (acc[d.role] = acc[d.role] ?? []).push(d.name);
        return acc;
      }, {}),
  );

  return (
    <div className="stamp-detail-container">
      <div className="stamp-browse-header">
        <button className="header-badge-btn" onClick={() => navigate("/")}>
          <img src="/favicon.svg" alt="Home" />
        </button>
        <h2>Stamp Collecting</h2>
        <ProfileDropdown />
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
              className="stamp-detail-img stamp-detail-img--zoomable"
              onDoubleClick={() => openModal(activeImg)}
              title="Double-click to zoom"
            />
            {images.length > 1 && (
              <>
                <button
                  className="stamp-img-arrow stamp-img-arrow--prev"
                  onClick={prevImg}
                  aria-label="Previous image"
                >
                  &#8249;
                </button>
                <button
                  className="stamp-img-arrow stamp-img-arrow--next"
                  onClick={nextImg}
                  aria-label="Next image"
                >
                  &#8250;
                </button>
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
          {stamp.sheet_img && (
            <div className="stamp-sheet-wrap">
              <p className="stamp-sheet-label">Full Sheet</p>
              <img
                src={stamp.sheet_img}
                alt={`${stamp.name} full sheet`}
                className="stamp-sheet-img stamp-detail-img--zoomable"
                onDoubleClick={() =>
                  openModal(allImages.indexOf(stamp.sheet_img))
                }
                title="Double-click to zoom"
              />
            </div>
          )}
        </div>

        {/* Right: info */}
        <div className="stamp-detail-info">
          <div className="stamp-detail-name-row">
            <h1 className="stamp-detail-name">{stamp.name}</h1>
            <div className="stamp-detail-action-btns">
              <div className="stamp-detail-action-wrap">
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
                {wishlistAddedAt && (
                  <span className="stamp-detail-added-date">
                    Added{" "}
                    {new Date(wishlistAddedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
              <div className="stamp-detail-action-wrap">
                <button
                  className={`stamp-detail-action-btn stamp-detail-check ${collected ? "collected" : ""}`}
                  onClick={toggleCollection}
                  disabled={togglingCollection}
                  aria-label={
                    collected ? "Remove from collection" : "Add to collection"
                  }
                >
                  {collected ? <BsCheckCircleFill /> : <BsCheckCircle />}
                  <span>
                    {collected ? "In Collection" : "Add to Collection"}
                  </span>
                </button>
                {collectionAddedAt && (
                  <span className="stamp-detail-added-date">
                    Added{" "}
                    {new Date(collectionAddedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
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
                  {primaryDesigners.map((d) => (
                    <span key={d.name} style={{ display: "block" }}>
                      {d.name}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {otherDesignerGroups.map(([role, names]) => (
              <div key={role} className="stamp-meta-item">
                <span className="stamp-meta-label">{role}</span>
                <span className="stamp-meta-value">
                  {names.map((name) => (
                    <span key={name} style={{ display: "block" }}>
                      {name}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>

          {stamp.description && (
            <div className="stamp-detail-description">
              <h3 className="stamp-desc-heading">About this Stamp</h3>
              <p>{stamp.description}</p>
            </div>
          )}

          {stamp.usps_url && (
            <a
              href={stamp.usps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="stamp-usps-link"
            >
              Buy on USPS Store →
            </a>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="stamp-lightbox-overlay" onClick={closeModal}>
          <button
            className="stamp-lightbox-close"
            onClick={closeModal}
            aria-label="Close"
          >
            ×
          </button>
          {allImages.length > 1 && (
            <button
              className="stamp-lightbox-arrow stamp-lightbox-arrow--prev"
              onClick={(e) => {
                e.stopPropagation();
                modalPrev();
              }}
              aria-label="Previous image"
            >
              &#8249;
            </button>
          )}
          <div
            className="stamp-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={allImages[modalIdx]}
              alt={stamp.name}
              className="stamp-lightbox-img"
            />
          </div>
          {allImages.length > 1 && (
            <button
              className="stamp-lightbox-arrow stamp-lightbox-arrow--next"
              onClick={(e) => {
                e.stopPropagation();
                modalNext();
              }}
              aria-label="Next image"
            >
              &#8250;
            </button>
          )}
          {allImages.length > 1 && (
            <span className="stamp-lightbox-counter">
              {modalIdx + 1} / {allImages.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StampDetailPage;
