import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  brokerPriorityTierToScore,
  companyRowToVisitSchedulingConfig,
  configsEqual,
  scoreToBrokerPriorityTier,
} from './aiVisitScheduling.ts';

describe('aiVisitScheduling', () => {
  it('companyRowToVisitSchedulingConfig mapeia colunas da empresa', () => {
    const cfg = companyRowToVisitSchedulingConfig({
      ai_visit_broker_mode: 'priority',
      ai_visit_priority_criterion: 'numeric',
      ai_visit_broker_priorities: { 'a-b-c-d-e-f': 90 },
    });
    assert.equal(cfg.mode, 'priority');
    assert.equal(cfg.priorityCriterion, 'numeric');
    assert.equal(cfg.brokerPriorities['a-b-c-d-e-f'], 90);
  });

  it('prioridade numérica ↔ tier', () => {
    assert.equal(scoreToBrokerPriorityTier(100), 'high');
    assert.equal(scoreToBrokerPriorityTier(50), 'medium');
    assert.equal(scoreToBrokerPriorityTier(10), 'low');
    assert.equal(brokerPriorityTierToScore('high'), 100);
    assert.equal(brokerPriorityTierToScore('medium'), 50);
  });

  it('configsEqual detecta mudanças', () => {
    const a = companyRowToVisitSchedulingConfig({
      ai_visit_broker_mode: 'queue',
      ai_visit_priority_criterion: 'numeric',
      ai_visit_broker_priorities: {},
    });
    const b = { ...a, mode: 'manual' as const };
    assert.equal(configsEqual(a, a), true);
    assert.equal(configsEqual(a, b), false);
  });
});
