import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import VerifyPage from "./pages/VerifyPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/verify/:codigo" element={<VerifyPage />} />
    </Routes>
  </BrowserRouter>
);