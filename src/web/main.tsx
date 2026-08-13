import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminAccountPage, AdminCatsPage, AdminContactPage, AdminProductEditPage, AdminProductsPage, AdminShopPage, AdminUsersPage } from "./pages-admin";
import { AdminLoginPage, GatePage, UserLoginPage } from "./pages-auth";
import { CartPage, MePage, ProfilePage } from "./pages-cart-me";
import { CatListPage, CatsPage, DetailPage, HomePage, SearchPage } from "./pages-shop";
import { StoreProvider } from "./store";
import "./styles.css";

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GatePage />} />
          <Route path="/login/user" element={<UserLoginPage />} />
          <Route path="/login/admin" element={<AdminLoginPage />} />
          <Route path="/shop" element={<HomePage />} />
          <Route path="/shop/cats" element={<CatsPage />} />
          <Route path="/shop/cats/:id" element={<CatListPage />} />
          <Route path="/shop/search" element={<SearchPage />} />
          <Route path="/shop/p/:id" element={<DetailPage />} />
          <Route path="/shop/cart" element={<CartPage />} />
          <Route path="/shop/me" element={<MePage />} />
          <Route path="/shop/me/edit" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminShopPage />} />
          <Route path="/admin/contact" element={<AdminContactPage />} />
          <Route path="/admin/cats" element={<AdminCatsPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/products/:id" element={<AdminProductEditPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/account" element={<AdminAccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
