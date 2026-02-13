import React, { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

interface PublicRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

// Component for routes that should only be accessible when NOT authenticated (like login/register)
const PublicRoute: React.FC<PublicRouteProps> = ({
  children,
  redirectTo = "/dashboard",
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
