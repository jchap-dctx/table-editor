import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "@kontent-ai/stylekit";
import { EnsureKontentAsParent } from "./components";
import { CustomElementContext } from "./context";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EnsureKontentAsParent>
      <CustomElementContext height="dynamic">
        <BrowserRouter basename="/custom-elements">
          <App />
        </BrowserRouter>
      </CustomElementContext>
    </EnsureKontentAsParent>
  </StrictMode>,
);
