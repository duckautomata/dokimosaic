import { createBrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home";
import Feedback from "./pages/Feedback";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

export const router = createBrowserRouter(
    [
        {
            path: "/",
            element: <App />,
            errorElement: <RouteErrorBoundary />,
            children: [
                { index: true, element: <Home />, errorElement: <RouteErrorBoundary /> },
                { path: "feedback", element: <Feedback />, errorElement: <RouteErrorBoundary /> },
            ],
        },
    ],
    { basename: "/dokimosaic/" },
);
