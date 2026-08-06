import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BiArrowBack, BiPencil } from "react-icons/bi";
import { useAuth } from "../context/AuthContext";
import ProfileDropdown from "../components/ProfileDropdown";
import "./ProfilePage.css";

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/stamps/collection", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/stamps/wishlist", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/messages", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : []
      ),
    ]).then(([collection, wishlist, messages]) => {
      const myMessages = messages.filter(
        (m) => m.user_id === user?.user_id && !m.parent_id
      );
      setStats({
        collected: collection.length,
        wishlisted: wishlist.length,
        messages: myMessages.length,
      });
    });
  }, [user?.user_id]);

  const startEditing = () => {
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setAvatarFile(null);
    setAvatarPreview(null);
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      if (username !== user?.username) formData.append("username", username);
      if (email !== user?.email) formData.append("email", email);
      if (avatarFile) formData.append("avatar", avatarFile);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      updateUser(data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : "";
  const initial = user?.username?.[0]?.toUpperCase() || "?";
  const avatarSrc = avatarPreview || user?.avatar_url || null;

  return (
    <div className="profile-page">
      <div className="profile-page-header">
        <button className="profile-back-btn" onClick={() => navigate(-1)}>
          <BiArrowBack size={18} />
          Back
        </button>
        <h2>Profile</h2>
        <ProfileDropdown />
      </div>

      <div className="profile-content">
        <div className="profile-card">
          {!editing && (
            <button className="profile-edit-btn" onClick={startEditing}>
              <BiPencil size={15} />
              Edit
            </button>
          )}

          {editing ? (
            <label className="profile-avatar-upload" htmlFor="avatar-input">
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar" className="profile-avatar-img" />
              ) : (
                <span className="profile-avatar-initial">{initial}</span>
              )}
              <span className="profile-avatar-overlay">Change photo</span>
              <input
                id="avatar-input"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: "none" }}
              />
            </label>
          ) : (
            <div className="profile-avatar-large">
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar" className="profile-avatar-img" />
              ) : (
                initial
              )}
            </div>
          )}

          {editing ? (
            <div className="profile-edit-fields">
              <div className="profile-field">
                <label className="profile-field-label">Username</label>
                <input
                  className="profile-field-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="profile-field">
                <label className="profile-field-label">Email</label>
                <input
                  className="profile-field-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="profile-edit-error">{error}</p>}
              <div className="profile-edit-actions">
                <button
                  className="profile-edit-cancel"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="profile-edit-save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="profile-username">{displayName}</h1>
              {user?.email && <p className="profile-email">{user.email}</p>}
            </>
          )}
        </div>

        {stats && (
          <div className="profile-stats">
            <div className="profile-stat-card">
              <span className="profile-stat-number">{stats.collected}</span>
              <span className="profile-stat-label">Stamps Collected</span>
            </div>
            <div className="profile-stat-card">
              <span className="profile-stat-number">{stats.wishlisted}</span>
              <span className="profile-stat-label">On Wishlist</span>
            </div>
            <div className="profile-stat-card">
              <span className="profile-stat-number">{stats.messages}</span>
              <span className="profile-stat-label">Messages Posted</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
