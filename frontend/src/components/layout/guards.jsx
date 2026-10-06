import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { PageLoader } from "../ui/primitives";

// Send signed-out buyers to /login and bring them back afterwards
export const RequireUser = ({ children }) => {
  const { status } = useSelector((s) => s.auth);
  const loc = useLocation();
  if (status === "loading") return <PageLoader />;
  if (status !== "authed") {
    return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  }
  return children;
};

export const RequireSeller = ({ children }) => {
  const { status } = useSelector((s) => s.seller);
  if (status === "loading") return <PageLoader />;
  if (status !== "authed") return <Navigate to="/shop-login" replace />;
  return children;
};
