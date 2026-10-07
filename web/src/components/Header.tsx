import './Header.css';

interface HeaderProps {
  sidebarOpen: boolean;
  showSidebarToggle: boolean;
  onToggleSidebar: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  pluginsOpen: boolean;
  onTogglePlugins: () => void;
}

function Header({
  sidebarOpen,
  showSidebarToggle,
  onToggleSidebar,
  settingsOpen,
  onToggleSettings,
  pluginsOpen,
  onTogglePlugins,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        {showSidebarToggle && (
          <button
            className="header-icon-button"
            onClick={onToggleSidebar}
            title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
            aria-label={sidebarOpen ? '收起侧栏' : '展开侧栏'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
          </button>
        )}
      </div>

      <div className="header-center">
        <div className="logo">
          <svg className="logo-icon" width="22" height="22" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <rect className="logo-icon-badge" x="4" y="4" width="56" height="56" rx="14" />
            <path d="M44 20 a16 16 0 1 0 0 24" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            <circle className="logo-icon-dot" cx="46" cy="32" r="4" />
          </svg>
          <span className="logo-text">ClipNote</span>
        </div>
      </div>

      <div className="header-right">
        <button
          className={`header-icon-button ${pluginsOpen ? 'active' : ''}`}
          onClick={onTogglePlugins}
          title="插件管理"
          aria-label="插件管理"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2.004a2.998 2.998 0 0 1 2.994 2.819l.005.176h2.251c.867 0 1.587.631 1.726 1.46l.018.147.006.144v3.75l-1.998.001a1.5 1.5 0 0 0-1.48 1.239l-.016.132-.005.129a1.5 1.5 0 0 0 1.24 1.48l.132.015.128.005H20L20 17.252a1.75 1.75 0 0 1-1.607 1.745l-.143.005H16l-.005.172a3 3 0 0 1-2.638 2.803l-.18.016-.177.005a3 3 0 0 1-2.995-2.82L10 19.002H7.75a1.75 1.75 0 0 1-1.726-1.458l-.018-.148L6 17.253V15l-.164-.005a3 3 0 0 1-2.803-2.638l-.016-.18L3.012 12a3 3 0 0 1 2.824-2.995l.163-.005L6 6.75c0-.867.63-1.587 1.458-1.726l.148-.019L7.75 5 10 4.999l.005-.171a3 3 0 0 1 2.638-2.803l.18-.016.177-.005Zm0 1.5a1.5 1.5 0 0 0-1.493 1.356l-.007.145-.001 1.494H7.75a.25.25 0 0 0-.243.193L7.5 6.75v3.75l-1.488.001a1.5 1.5 0 0 0-.144 2.993l.144.007H7.5l.001 3.751a.25.25 0 0 0 .193.244l.057.006h3.749l.001 1.496a1.5 1.5 0 0 0 2.993.145L14.5 19l-.001-1.497h3.751a.25.25 0 0 0 .244-.192l.006-.057V15h-.524l-.18-.006a3.003 3.003 0 0 1-2.79-2.841l-.004-.177.006-.18a3 3 0 0 1 2.819-2.79l.174-.005h.498L18.5 6.75a.25.25 0 0 0-.13-.22l-.063-.024-.057-.006-3.751-.001.001-1.495a1.5 1.5 0 0 0-1.5-1.5Z" />
          </svg>
        </button>
        <button
          className={`header-icon-button ${settingsOpen ? 'active' : ''}`}
          onClick={onToggleSettings}
          title="设置"
          aria-label="设置"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Header;
