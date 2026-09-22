import { ConsumptionAnalytics } from "@/components/ConsumptionAnalytics";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ConsumptionAnalyticsPage = () => {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <Button variant="outline" onClick={() => navigate("/")}> 
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
      <ConsumptionAnalytics />
    </div>
  );
};

export default ConsumptionAnalyticsPage;
