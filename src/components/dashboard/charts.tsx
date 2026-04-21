"use client";

import React from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((entry, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface VentasComprasData {
  mes: string;
  ventas: number;
  compras: number;
}

interface FlujoCajaData {
  semana: string;
  ingresos: number;
  egresos: number;
  neto: number;
}

interface DocumentosData {
  tipo: string;
  cantidad: number;
  porcentaje: number;
}

interface VentasComprasChartProps {
  data?: VentasComprasData[];
}

interface FlujoCajaChartProps {
  data?: FlujoCajaData[];
}

interface DocumentosChartProps {
  data?: DocumentosData[];
}

const defaultVentasComprasData: VentasComprasData[] = [
  { mes: "Oct", ventas: 120000, compras: 85000 },
  { mes: "Nov", ventas: 135000, compras: 92000 },
  { mes: "Dic", ventas: 110000, compras: 78000 },
  { mes: "Ene", ventas: 150000, compras: 105000 },
  { mes: "Feb", ventas: 165000, compras: 115000 },
  { mes: "Mar", ventas: 180000, compras: 125000 },
  { mes: "Abr", ventas: 195000, compras: 135000 },
];

const defaultFlujoCajaData: FlujoCajaData[] = [
  { semana: "Sem 1", ingresos: 45000, egresos: 32000, neto: 13000 },
  { semana: "Sem 2", ingresos: 52000, egresos: 38000, neto: 14000 },
  { semana: "Sem 3", ingresos: 48000, egresos: 35000, neto: 13000 },
  { semana: "Sem 4", ingresos: 55000, egresos: 42000, neto: 13000 },
];

const defaultDocumentosData: DocumentosData[] = [
  { tipo: "FACTURA", cantidad: 245, porcentaje: 45 },
  { tipo: "BOLETA", cantidad: 67, porcentaje: 25 },
  { tipo: "NOTA_CREDITO", cantidad: 18, porcentaje: 15 },
  { tipo: "NOTA_DEBITO", cantidad: 12, porcentaje: 10 },
  { tipo: "OTROS", cantidad: 8, porcentaje: 5 },
];

export function VentasComprasChart({ data = defaultVentasComprasData }: VentasComprasChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
          formatter={(value) => <span className="text-gray-600">{value}</span>}
        />
        <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#2563eb" strokeWidth={2} fill="url(#colorVentas)" dot={{ r: 3, fill: "#2563eb" }} />
        <Area type="monotone" dataKey="compras" name="Compras" stroke="#10b981" strokeWidth={2} fill="url(#colorCompras)" dot={{ r: 3, fill: "#10b981" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FlujoCajaChart({ data = defaultFlujoCajaData }: FlujoCajaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#2563eb" radius={[4, 4, 0, 0]} />
        <Bar dataKey="egresos" name="Egresos" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DocumentosChart({ data = defaultDocumentosData }: DocumentosChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={3}
          dataKey="cantidad"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name, props) => [
            `${value} docs (${props.payload.porcentaje}%)`,
            props.payload.tipo,
          ]}
          contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px" }}
          formatter={(value) => (
            <span className="text-gray-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}