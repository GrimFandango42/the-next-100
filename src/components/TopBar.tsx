import { VIEWS, VIEW_LABEL } from "../route";
import { useStore } from "../store";

/** The one bar on every view: the site's name, then This week, Odds and The book. Plain links, so back and forward just work. */
export default function TopBar() {
  const { route } = useStore();
  return (
    <header className="topbar">
      <span className="topbar-name">The Next <b>100</b></span>
      <nav className="topbar-views" aria-label="Views">
        {VIEWS.map((v) => (
          <a key={v} href={`#${v}`} data-view={v} aria-current={route.view === v ? "page" : undefined}>{VIEW_LABEL[v]}</a>
        ))}
      </nav>
    </header>
  );
}
