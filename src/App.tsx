import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Achievements from "./pages/Achievements";
import MyOrders from "./pages/MyOrders";
import MySales from "./pages/MySales";
import ProfilePage from "./pages/ProfilePage";
import AdminUsers from "./pages/AdminUsers";
import ExpenditureAnalyticsPage from "./pages/ExpenditureAnalytics";
import ConsumptionAnalyticsPage from "./pages/ConsumptionAnalytics";
import NotFound from "./pages/NotFound";
import BillUpload from "./pages/BillUpload";
import { ClickSpark } from "@/components/effects/ClickSpark";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ClickSpark sparkColor="#f4f4f5" sparkCount={12} sparkRadius={28} sparkSize={12} extraScale={1.25}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/my-sales" element={<MySales />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/expenditure" element={<ExpenditureAnalyticsPage />} />
            <Route path="/consumption" element={<ConsumptionAnalyticsPage />} />
            <Route path="/analytics/expenditure" element={<ExpenditureAnalyticsPage />} />
            <Route path="/analytics/consumption" element={<ConsumptionAnalyticsPage />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/bill-upload" element={<BillUpload />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ClickSpark>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
