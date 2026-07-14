import { describe, expect, it } from 'vitest';
import { ENHANCED_SENSORY_DATA } from '../data/enhanced-sensory';
import { calculateGoStopTweakDecision } from '../utils/go-stop-tweak-engine';
import { buildTweakDiagnosisRequest, buildTweakEvidenceChain, tweakDiagnosisCacheKey } from './tweak-intelligence';

const weights = { hedonic: 30, texture: 25, cata: 25, emotional: 15 };

describe('tweak intelligence client contract', () => {
  it('builds a backend diagnosis request from the selected decision and sensory profile', () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S2');
    expect(profile).toBeTruthy();
    const decision = calculateGoStopTweakDecision(profile!, weights, 'cheese');

    const request = buildTweakDiagnosisRequest({ decision, profile: profile!, foodType: 'cheese' });

    expect(request.sample.sampleId).toBe(profile!.sampleId);
    expect(request.decision.decisionFingerprint).toBe(decision.decisionFingerprint);
    expect(request.sensoryEvidence.dimensionScores.texture).toBe(decision.dimensionScores.texture);
    expect(request.sensoryEvidence.cata.Butter).toBe(10);
    expect(request.instrumentalEvidence.taste.bitterness).toBe(profile!.taste.bitterness);
    expect(request.instrumentalEvidence.composition.protein).toBe(profile!.composition.protein);
    expect(request.instrumentalEvidence.gcmsOlfactometry[0]?.compound).toBe('Diacetyl');
    expect(request.instrumentalEvidence.qc.istdRecovery).toBe(profile!.istdRecovery);
    expect(request.languageContext.categoryFamily).toBe('cheese');
    expect(request.languageContext.primaryIssue.kind).toBe('texture');
    expect(request.options.evidenceDepth).toBe('all_applicable');
    expect(request.options.reportMode).toBe('deterministic_only');
    expect(request.question).toContain(decision.sampleName);
    expect(request.question).toContain('do not infer a formulation cause from aggregate CATA');
    expect(tweakDiagnosisCacheKey(request)).toContain(decision.decisionFingerprint);

    const changedRequest = {
      ...request,
      sensoryEvidence: {
        ...request.sensoryEvidence,
        cata: {
          ...request.sensoryEvidence.cata,
          Chalky: (request.sensoryEvidence.cata.Chalky ?? 0) + 1,
        },
      },
    };
    expect(tweakDiagnosisCacheKey(changedRequest)).not.toBe(tweakDiagnosisCacheKey(request));
  });

  it('normalizes plant-based cheese texture requests before calling the backend', () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'S1');
    expect(profile).toBeTruthy();
    const decision = calculateGoStopTweakDecision(profile!, weights, 'pbca');

    const request = buildTweakDiagnosisRequest({ decision, profile: profile!, foodType: 'pbca' });

    expect(request.languageContext.foodTypeSlug).toBe('plant_based_cheese');
    expect(request.languageContext.categoryLabel).toBe('Plant-based cheese alternative');
    expect(request.languageContext.categoryFamily).toBe('plant_based_cheese');
    expect(request.languageContext.primaryIssue.kind).toBe('texture');
    expect(request.languageContext.primaryIssue.target).toBe('Texture rebuild');
    expect(request.languageContext.protectedAttributes).toEqual(expect.arrayContaining(['Butter', 'Cheese']));
  });

  it('protects a GO bread profile instead of turning category-positive acidity into an aroma defect', () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'B11');
    expect(profile).toBeTruthy();
    const decision = calculateGoStopTweakDecision(profile!, weights, 'bread');

    const request = buildTweakDiagnosisRequest({ decision, profile: profile!, foodType: 'bread' });

    expect(request.languageContext.categoryFamily).toBe('bread');
    expect(decision.decision).toBe('GO');
    expect(request.languageContext.primaryIssue.kind).toBe('go_protection');
    expect(request.languageContext.primaryIssue.compound).toBeUndefined();
  });

  it('classifies dairy kefir correctly and protects its positive identity cues', () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'YG-007');
    expect(profile).toBeTruthy();
    const decision = calculateGoStopTweakDecision(profile!, weights, 'yogurt');

    const request = buildTweakDiagnosisRequest({ decision, profile: profile!, foodType: 'yogurt' });

    expect(request.languageContext.categoryFamily).toBe('yogurt');
    expect(request.languageContext.categoryLabel).toBe('Yogurt or kefir');
    expect(request.languageContext.protectedAttributes).toEqual(
      expect.arrayContaining(['Tangy', 'Fermented', 'Fresh', 'Smooth']),
    );
    expect(request.sensoryEvidence.panelN).toBe(14);
  });

  it('keeps the Lemon Kefir recommendation tied to its measured category-fit blocker', () => {
    const profile = ENHANCED_SENSORY_DATA.find(item => item.sampleId === 'YG-007');
    expect(profile).toBeTruthy();
    const decision = calculateGoStopTweakDecision(profile!, weights, 'yogurt');

    const chain = buildTweakEvidenceChain({ decision, profile: profile!, foodType: 'yogurt', goThreshold: 75 });

    expect(chain.observation).toContain('Category / lexicon fit');
    expect(chain.observation).toContain('30/100');
    expect(chain.observation).toContain('13.5 ISSF points below GO');
    expect(chain.hypothesisStatus).toBe('needs_confirmation');
    expect(chain.hypothesis).toContain('do not prove that texture caused');
    expect(chain.verification).toContain('benchmark');
    expect(chain.experimentScope).toContain('C0 plus no more than three');
    expect(chain.advancementGates).toEqual(expect.arrayContaining([
      expect.stringContaining('ISSF reaches GO ≥ 75'),
      expect.stringContaining('fresh confirmation batch'),
    ]));
    expect(chain.evidenceBoundary).toContain('does not establish consumer concept');
  });
});
