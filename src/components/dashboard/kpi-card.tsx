import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  trend?: "up" | "down" | "neutral";
  trendPositive?: boolean; // whether "up" is good or bad
  alert?: boolean;
  alertLevel?: "error" | "warning" | "info";
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-blue-600",
  iconBg = "bg-blue-50",
  trend,
  trendPositive = true,
  alert,
  alertLevel = "info",
  className,
}: KpiCardProps) {
  const alertStyles = {
    error: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
    info: "border-blue-200 bg-blue-50",
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow",
        alert && alertStyles[alertLevel],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
        <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ml-3", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>

      {(change !== undefined || changeLabel) && (
        <div className="mt-3 flex items-center gap-1.5">
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              trend === "up" && trendPositive ? "text-emerald-600" :
              trend === "up" && !trendPositive ? "text-red-600" :
              trend === "down" && trendPositive ? "text-red-600" :
              trend === "down" && !trendPositive ? "text-emerald-600" :
              "text-gray-500"
            )}>
              {trend === "up" && <TrendingUp className="w-3.5 h-3.5" />}
              {trend === "down" && <TrendingDown className="w-3.5 h-3.5" />}
              {trend === "neutral" && <Minus className="w-3.5 h-3.5" />}
              {change > 0 ? "+" : ""}{change.toFixed(1)}%
            </div>
          )}
          {changeLabel && (
            <span className="text-xs text-gray-400">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
