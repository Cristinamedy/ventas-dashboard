"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Calendar as CalendarIcon, RefreshCcw } from "lucide-react";

// ===== Tipos =====
type Sale = {
  date: string;        // YYYY-MM-DD
  salesperson: string; // nombre del comercial
  amount: number;      // importe de la venta
};

type Settings = {
  currency: string; // símbolo, ej. "€"
  timezone: string; // IANA, ej. "Europe/Madrid"
};

// ===== Utilidades de fecha =====
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const todayLocalISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  return `${y}-${m}-${d}`;
};

const yearFromISO = (isoDate: string) => isoDate.slice(0, 4);
const monthFromISO = (isoDate: string) => isoDate.slice(0, 7); // YYYY-MM

// ===== Datos de ejemplo =====
const SAMPLE_DATA: Sale[] = [
  { date: todayLocalISO(), salesperson: "Ana", amount: 320 },
  { date: todayLocalISO(), salesperson: "Luis", amount: 150 },
  { date: todayLocalISO(), salesperson: "Marta", amount: 420 },
];

// ===== Parser CSV flexible =====
function normalizeHeader(h: string) {
  const x = h.trim().toLowerCase();
  if (["date", "fecha"].includes(x)) return "date";
  if (["salesperson", "comercial", "vendedor"].includes(x)) return "salesperson";
  if (["amount", "importe", "monto", "total"].includes(x)) return "amount";
  return x;
}

function splitSmart(line: string): string[] {
  const sep = line.includes(";") && !line.includes(",") ? ";" : ",";
  return line.split(sep).map((s) => s.trim());
}

function parseCSV(content: string): Sale[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const first = splitSmart(lines[0]).map(normalizeHeader);
  let startIdx = 0;
  let mapIdx = { date: 0, salesperson: 1, amount: 2 } as Record<string, number>;

  if (["date", "salesperson", "amount"].every((h) => first.includes(h))) {
    startIdx = 1;
    mapIdx = {
      date: first.indexOf("date"),
      salesperson: first.indexOf("salesperson"),
      amount: first.indexOf("amount"),
    };
  }

  const out: Sale[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const row = splitSmart(lines[i]);
    const date = row[mapIdx.date]?.trim();
    const salesperson = row[mapIdx.salesperson]?.trim();
    const amountStr = row[mapIdx.amount]?.trim();

    if (!date || !/\d{4}-\d{2}-\d{2}/.test(date)) continue;
    if (!salesperson) continue;

    const normalized = amountStr
      ?.replace(/\s/g, "")
      ?.replace(/\.(?=\d{3}(\D|$))/g, "")
      ?.replace(/,(?=\d{3}(\D|$))/g, "")
      ?.replace(/,(\d{1,2})$/, ".$1");

    const amount = Number(normalized);
    if (Number.isNaN(amount)) continue;
    out.push({ date, salesperson, amount });
  }
  return out;
}

function toCSV(data: Sale[]): string {
  const header = "date,salesperson,amount";
  const rows = data.map((s) => `${s.date},${s.salesperson},${s.amount}`);
  return [header, ...rows].join("\n");
}

// ===== Agregaciones =====
function sum(nums: number[]) { return nums.reduce((a, b) => a + b, 0); }
function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

function useAggregates(sales: Sale[], selectedDate: string) {
  const monthKey = monthFromISO(selectedDate); // YYYY-MM
  const yearKey = yearFromISO(selectedDate);
  return useMemo(() => {
    const daySales = sales.filter((s) => s.date === selectedDate);
    const mtdSales = sales.filter((s) => s.date.startsWith(monthKey));
    const ytdSales = sales.filter((s) => s.date.startsWith(yearKey));

    const totalDay = sum(daySales.map((s) => s.amount));
    const totalMTD = sum(mtdSales.map((s) => s.amount));
    const totalYTD = sum(ytdSales.map((s) => s.amount));

    const bySalespersonDay = Object.entries(groupBy(daySales, (s) => s.salesperson))
      .map(([name, arr]) => ({ name, totalDay: sum(arr.map((a) => a.amount)) }))
      .sort((a, b) => b.totalDay - a.totalDay);

    const bySalespersonMTD = Object.entries(groupBy(mtdSales, (s) => s.salesperson))
      .map(([name, arr]) => ({ name, totalMTD: sum(arr.map((a) => a.amount)) }))
      .sort((a, b) => b.totalMTD - a.totalMTD);

    const map = new Map<string, { name: string; totalDay: number; totalMTD: number }>();
    bySalespersonMTD.forEach((m) => map.set(m.name, { name: m.name, totalDay: 0, totalMTD: m.totalMTD }));
    bySalespersonDay.forEach((d) => {
      const prev = map.get(d.name) || { name: d.name, totalDay: 0, totalMTD: 0 };
      map.set(d.name, { ...prev, totalDay: d.totalDay });
    });
    const bySalesperson = Array.from(map.values()).sort((a, b) => b.totalMTD - a.totalMTD);

    return { totalDay, totalMTD, totalYTD, bySalesperson, daySales };
  }, [sales, selectedDate]);
}

// ===== UI principal =====
export default function SalesDashboard() {
  const [sales, setSales] = useState<Sale[]>(SAMPLE_DATA);
  const [settings, setSettings] = useState<Settings>({ currency: "€", timezone: "Europe/Madrid" });
  const [selectedDate, setSelectedDate] = useState<string>(todayLocalISO());

  const { totalDay, totalMTD, totalYTD, bySalesperson, daySales } = useAggregates(sales, selectedDate);

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || "");
      const parsed = parseCSV(txt);
      if (parsed.length === 0) alert("No se detectaron filas válidas en el CSV.");
      setSales(parsed);
    };
    reader.readAsText(file);
  };

  const downloadCSV = () => {
    const blob = new Blob([toCSV(sales)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ventas.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard de Ventas</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCSV}><Download className="w-4 h-4 mr-2"/>Exportar</Button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader><CardTitle>Ventas de hoy</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{settings.currency}{totalDay.toLocaleString()}</CardContent></Card>
          <Card><CardHeader><CardTitle>Acumulado Mes</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{settings.currency}{totalMTD.toLocaleString()}</CardContent></Card>
          <Card><CardHeader><CardTitle>Acumulado Año</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{settings.currency}{totalYTD.toLocaleString()}</CardContent></Card>
        </div>

        {/* Comerciales */}
        <Card className="mt-6">
          <CardHeader><CardTitle>Rendimiento por comercial</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comercial</TableHead>
                  <TableHead className="text-right">Hoy</TableHead>
                  <TableHead className="text-right">Mes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySalesperson.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{settings.currency}{r.totalDay.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{settings.currency}{r.totalMTD.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Importación CSV */}
        <Card className="mt-6">
          <CardHeader><CardTitle>Importar CSV</CardTitle></CardHeader>
          <CardContent>
            <Input type="file" accept=".csv" onChange={(e) => e.target.files && onUpload(e.target.files[0])} />
          </CardContent>
        </Card>

        {/* Ventas del día */}
        <Card className="mt-6">
          <CardHeader><CardTitle>Ventas del {selectedDate}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Comercial</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
              <TableBody>
                {daySales.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center">Sin ventas</TableCell></TableRow>
                ) : (
                  daySales.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell>{s.date}</TableCell>
                      <TableCell>{s.salesperson}</TableCell>
                      <TableCell className="text-right">{settings.currency}{s.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
