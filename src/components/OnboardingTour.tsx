import { useEffect, useState, useCallback } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";

interface OnboardingTourProps {
  run: boolean;
  onComplete: () => void;
  hasPantryItems?: boolean;
}

export const OnboardingTour = ({ run, onComplete, hasPantryItems = false }: OnboardingTourProps) => {
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    // Define core tour steps that always exist
    const coreSteps: Step[] = [
      {
        target: "#tour-add-item",
        content: "Use this button to add new items to your pantry. You can manually enter details or scan barcodes!",
        placement: "bottom",
        disableBeacon: true,
      },
    ];

    // Add pantry item-specific steps if items exist
    if (hasPantryItems) {
      coreSteps.push(
        {
          target: ".pantry-item-card",
          content: "Each pantry item card shows your stock quantity, unit, and expiry date. Manage everything from here!",
          placement: "top",
          disableBeacon: true,
        },
        {
          target: "[data-tour='edit-quantity']",
          content: "Update the quantity of your items directly from the card. Use the +/- buttons or type a new value.",
          placement: "top",
          disableBeacon: true,
        },
        {
          target: "[data-tour='delete-item']",
          content: "Tap the delete button to remove items you've finished or no longer need.",
          placement: "left",
          disableBeacon: true,
        },
        {
          target: "[data-tour='sell-donate']",
          content: "Sell items you don't need or donate them to others. Great for items nearing expiry!",
          placement: "left",
          disableBeacon: true,
        }
      );
    }

    // Add remaining steps
    coreSteps.push(
      {
        target: "#tour-expiring-summary-card",
        content: "Keep track of items expiring soon. Click here to see everything that needs attention!",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: "[data-tour='tab-marketplace']",
        content: "Browse the marketplace to sell nearly expiring products or buy from others at cheaper prices!",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: "[data-tour='tab-cart']",
        content: "Your shopping list! Add items here and order directly from Blinkit or Swiggy.",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: "#tour-voice-assistant",
        content: "Use voice commands to add items, check your pantry, or get quick updates hands-free!",
        placement: "left",
        disableBeacon: true,
      },
      {
        target: "#tour-ocr-upload",
        content: "Upload a grocery bill photo and we'll automatically add all items to your pantry using OCR!",
        placement: "left",
        disableBeacon: true,
      },
      {
        target: "[data-tour='ai-chef']",
        content: "Meet Iron Chef! Get recipe suggestions based on your pantry items and cooking tips.",
        placement: "right",
        disableBeacon: true,
      }
    );

    setSteps(coreSteps);
  }, [hasPantryItems]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status } = data;

      if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
        onComplete();
      }
    },
    [onComplete]
  );

  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableScrolling={false}
      spotlightClicks
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 20,
        },
        tooltipContainer: {
          textAlign: "left",
        },
        buttonNext: {
          backgroundColor: "hsl(var(--primary))",
          borderRadius: 8,
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 600,
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          marginRight: 10,
          fontSize: 14,
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
          fontSize: 14,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
};

