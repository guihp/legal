import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAgendaEventCorretor } from "./agendaCorretor.ts";

const calendars = [
  { id: "cal-thayna", full_name: "Plantão Jastelo", brokerName: "Thayna" },
  { id: "cal-alan", full_name: "Alan Fonseca", brokerName: "Alan Fonseca" },
];

describe("resolveAgendaEventCorretor", () => {
  it("usa broker_name das extendedProperties", () => {
    const name = resolveAgendaEventCorretor({
      event: { extendedProperties: { private: { broker_name: "Maria" } } },
      selectedAgenda: "Todos",
      calendars,
    });
    assert.equal(name, "Maria");
  });

  it("mapeia calendarId para corretor do plantão quando Todos", () => {
    const name = resolveAgendaEventCorretor({
      event: { calendarId: "cal-thayna" },
      selectedAgenda: "Todos",
      calendars,
    });
    assert.equal(name, "Thayna");
  });

  it("extrai da description Corretor responsável", () => {
    const name = resolveAgendaEventCorretor({
      event: {},
      description: "Visita. Corretor responsável: João Silva.",
      selectedAgenda: "Todos",
      calendars,
    });
    assert.equal(name, "João Silva");
  });

  it("fallback da agenda filtrada", () => {
    const name = resolveAgendaEventCorretor({
      event: {},
      selectedAgenda: "cal-alan",
      calendars,
    });
    assert.equal(name, "Alan Fonseca");
  });
});
