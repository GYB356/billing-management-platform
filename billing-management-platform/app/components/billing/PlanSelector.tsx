"use client";

import { useState } from "react";

export function PlanSelector({ plans, currentPlanId, onPlanChange }: {
  plans: {
    id: string;
    name: string;
    stripeId: string;
    price: number;
    currency: string;
    features: string[];
  }[];
  currentPlanId: string;
  onPlanChange: (stripeId: string) => void;
}) {
  const [selected, setSelected] = useState(currentPlanId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {plans.map((plan) => (
        <div
          key={plan.id}
          onClick={() => {
            setSelected(plan.id);
            onPlanChange(plan.stripeId);
          }}
          className={`border p-4 rounded-xl cursor-pointer ${
            plan.id === selected ? "border-blue-500 bg-blue-50" : "border-gray-300"
          }`}
        >
          <h2 className="text-lg font-bold">{plan.name}</h2>
          <p className="text-sm text-gray-500">{plan.features.join(", ")}</p>
          <p className="mt-2 font-semibold">{plan.price / 100} {plan.currency}</p>
        </div>
      ))}
    </div>
  );
} 