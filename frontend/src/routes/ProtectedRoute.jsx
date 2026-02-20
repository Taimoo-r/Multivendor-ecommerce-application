import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const { loading, isAuthenticated } = useSelector((state) => state.user);

  // Handle loading state
  if (loading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children
};

export default ProtectedRoute;


