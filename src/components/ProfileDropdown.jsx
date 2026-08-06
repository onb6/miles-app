import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./ProfileDropdown.css";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const ProfileDropdown = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initial = user?.username?.[0]?.toUpperCase() || "?";
  const avatarSrc = user?.avatar_url || null;

  return (
    <div className="profile-dropdown-wrap" ref={ref}>
      <button
        className="profile-avatar-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile menu"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt="avatar" className="profile-avatar-btn-img" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="profile-dropdown-menu">
          <div className="profile-dropdown-header">
            <span className="profile-dropdown-name">{cap(user?.username)}</span>
          </div>
          <button
            className="profile-dropdown-item"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
          >
            Profile
          </button>
          <button
            className="profile-dropdown-item profile-dropdown-item--danger"
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;
