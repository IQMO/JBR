"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Example strategies and their parameters
const STRATEGIES = {
  SMA: {
    label: "Simple Moving Average",
    params: [
      { name: "period", label: "Period", type: "number", min: 1, max: 200, default: 14 },
      { name: "threshold", label: "Threshold", type: "number", min: 0, max: 100, default: 50 },
    ],
  },
  EMA: {
    label: "Exponential Moving Average",
    params: [
      { name: "period", label: "Period", type: "number", min: 1, max: 200, default: 14 },
      { name: "multiplier", label: "Multiplier", type: "number", min: 1, max: 10, default: 2 },
    ],
  },
  Custom: {
    label: "Custom Script",
    params: [
      { name: "script", label: "Strategy Script", type: "textarea" },
    ],
  },
};

const MARKET_TYPES = [
  { value: "spot", label: "Spot" },
  { value: "futures", label: "Futures" },
];

const schema = z.object({
  botName: z.string().min(3, "Bot name must be at least 3 characters"),
  marketType: z.enum(["spot", "futures"]),
  strategy: z.enum(["SMA", "EMA", "Custom"]),
  parameters: z.record(z.any()),
});

type FormData = z.infer<typeof schema>;

export default function BotCreatePage() {
  const [strategy, setStrategy] = useState<keyof typeof STRATEGIES>("SMA");
  const [marketType, setMarketType] = useState("spot");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      botName: "",
      marketType: "spot",
      strategy: "SMA",
      parameters: {},
    },
  });

  // Watch for changes to update dynamic fields
  const selectedStrategy = watch("strategy");
  const selectedMarketType = watch("marketType");

  useEffect(() => {
    if (selectedStrategy) {setStrategy(selectedStrategy as keyof typeof STRATEGIES);}
  }, [selectedStrategy]);
  useEffect(() => {
    if (selectedMarketType) {setMarketType(selectedMarketType);}
  }, [selectedMarketType]);

  // Dynamic parameter fields
  const parameterFields = STRATEGIES[strategy].params;

  // Example: market-specific parameters
  const marketSpecificFields =
    marketType === "futures"
      ? [
          { name: "leverage", label: "Leverage", type: "number", min: 1, max: 100, default: 10 },
          { name: "marginType", label: "Margin Type", type: "select", options: ["isolated", "cross"], default: "isolated" },
        ]
      : [];

  // Combine all parameter fields
  const allFields = [...parameterFields, ...marketSpecificFields];

  const onSubmit = async (data: FormData) => {
    // Prepare payload
    const payload = {
      botName: data.botName,
      marketType: data.marketType,
      strategy: data.strategy,
      parameters: data.parameters,
    };
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {throw new Error("Failed to create bot");}
      reset();
      alert("Bot created successfully!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("Error creating bot");
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Create New Trading Bot</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block font-medium">Bot Name</label>
          <input
            {...register("botName")}
            className="w-full border rounded px-3 py-2 mt-1"
            placeholder="Enter bot name"
            disabled={isSubmitting}
          />
          {errors.botName && <span className="text-red-500 text-sm">{errors.botName.message}</span>}
        </div>
        <div>
          <label className="block font-medium">Market Type</label>
          <select
            {...register("marketType")}
            className="w-full border rounded px-3 py-2 mt-1"
            disabled={isSubmitting}
          >
            {MARKET_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium">Strategy</label>
          <select
            {...register("strategy")}
            className="w-full border rounded px-3 py-2 mt-1"
            disabled={isSubmitting}
          >
            {Object.entries(STRATEGIES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {/* Dynamic parameter fields */}
        {allFields.map((field) => (
          <div key={field.name}>
            <label className="block font-medium">{field.label}</label>
            {field.type === "select" && "options" in field ? (
              <select
                {...register(`parameters.${field.name}`)}
                className="w-full border rounded px-3 py-2 mt-1"
                defaultValue={"default" in field ? String(field.default) : undefined}
                disabled={isSubmitting}
              >
                {Array.isArray(field.options) && field.options.map((opt: string) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                {...register(`parameters.${field.name}`)}
                className="w-full border rounded px-3 py-2 mt-1"
                rows={4}
                placeholder={field.label}
                disabled={isSubmitting}
              />
            ) : (
              <input
                type={field.type}
                {...register(`parameters.${field.name}`)}
                className="w-full border rounded px-3 py-2 mt-1"
                min={"min" in field ? String(field.min) : undefined}
                max={"max" in field ? String(field.max) : undefined}
                defaultValue={"default" in field ? String(field.default) : undefined}
                step={field.type === "number" ? 1 : undefined}
                disabled={isSubmitting}
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Bot"}
        </button>
      </form>
    </div>
  );
} 