import { ExpenditureAnalytics } from "@/components/ExpenditureAnalytics";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ExpenditureAnalyticsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <Button variant="outline" onClick={() => navigate("/")}> 
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <ExpenditureAnalytics />
      </div>
    </div>
  );
}


