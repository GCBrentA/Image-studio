import "@shopify/polaris/build/esm/styles.css";
import { NavMenu, TitleBar } from "@shopify/app-bridge-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { AppProvider } from "@shopify/polaris";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { Dashboard } from "./routes/Dashboard";
import { Products } from "./routes/Products";
import { Queue } from "./routes/Queue";
import { Settings } from "./routes/Settings";
import "./styles.css";

function App() {
  return (
    <AppProvider i18n={{}}>
      <BrowserRouter>
        <div className="optivra-shell">
          <TitleBar title="Optivra Image Studio" />
          <NavMenu>
            <a href="/" rel="home">Dashboard</a>
            <a href="/products">Products</a>
            <a href="/queue">Image Queue</a>
            <a href="/settings">Settings</a>
          </NavMenu>
          <aside className="optivra-nav">
            <div className="optivra-brand">Optivra Image Studio</div>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/products">Products</NavLink>
            <NavLink to="/queue">Image Queue</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </aside>
          <main className="optivra-main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/queue" element={<Queue />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
