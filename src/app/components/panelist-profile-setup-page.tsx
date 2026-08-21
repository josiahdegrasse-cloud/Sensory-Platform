import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, LockKeyhole, MapPin, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import {
  ALLERGEN_OPTIONS,
  DIETARY_PATTERN_OPTIONS,
  GENDER_OPTIONS,
  GROCERY_ROLE_OPTIONS,
  HEALTH_CONSENT_VERSION,
  splitOtherAvoidances,
  type AllergenCode,
} from '../lib/allergen-eligibility';
import { completePanelistProfile, CURRENT_CONSENT_VERSION } from '../lib/database';
import { useOwnPanelistProfileSetup } from '../lib/hooks';
import {
  ANNUAL_INCOME_OPTIONS,
  ETHNICITY_GROUPS,
  HOUSEHOLD_SIZE_OPTIONS,
  OCCUPATION_GROUP_OPTIONS,
  SMOKER_STATUS_OPTIONS,
  WEEKLY_FOOD_SHOP_OPTIONS,
  ethnicityGroup as ethnicityGroupForValue,
  ethnicityLabel,
  nationalityOptions,
} from '../lib/panelist-demographics';
import { isSamePasswordAuthError, panelistResearchProfileError } from '../lib/panelist-onboarding';
import { clearPanelistProfileDraft, loadPanelistProfileDraft, savePanelistProfileDraft } from '../lib/panelist-profile-draft';
import { supabase } from '../lib/supabase';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { PanelistConsentContent } from './legal-pages';

const STEPS = [
  { label: 'Account', icon: UserRound },
  { label: 'Safety', icon: ShieldCheck },
  { label: 'About you', icon: ClipboardCheck },
  { label: 'Delivery', icon: MapPin },
  { label: 'Review', icon: CheckCircle2 },
] as const;

const selectClassName = 'flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50';

function passwordError(password: string) {
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (!/[A-Z]/.test(password)) return 'Add at least one capital letter to your password.';
  if (!/[0-9]/.test(password)) return 'Add at least one number to your password.';
  return null;
}

export function PanelistProfileSetupPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const isProfileUpdate = Boolean(user?.profileCompletedAt);
  const ownProfile = useOwnPanelistProfileSetup(isProfileUpdate);
  const [restoredDraft] = useState(() => {
    if (!user?.id || isProfileUpdate || typeof window === 'undefined') return null;
    return loadPanelistProfileDraft(window.sessionStorage, user.id);
  });
  const hydratedProfile = useRef(false);
  const submitting = useRef(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(restoredDraft?.name ?? (user?.name === user?.email ? '' : user?.name ?? ''));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthMonth, setBirthMonth] = useState(restoredDraft?.birthMonth ?? '');
  const [birthYear, setBirthYear] = useState(restoredDraft?.birthYear ?? '');
  const [noKnownAllergies, setNoKnownAllergies] = useState(restoredDraft?.noKnownAllergies ?? false);
  const [allergenAvoidances, setAllergenAvoidances] = useState<AllergenCode[]>(restoredDraft?.allergenAvoidances ?? []);
  const [lactoseIntolerance, setLactoseIntolerance] = useState(restoredDraft?.lactoseIntolerance ?? false);
  const [otherAvoidances, setOtherAvoidances] = useState(restoredDraft?.otherAvoidances ?? '');
  const [healthConsent, setHealthConsent] = useState(restoredDraft?.healthConsent ?? false);
  const [gender, setGender] = useState(restoredDraft?.gender ?? '');
  const [genderSelfDescription, setGenderSelfDescription] = useState(restoredDraft?.genderSelfDescription ?? '');
  const [nationalityCode, setNationalityCode] = useState(restoredDraft?.nationalityCode ?? '');
  const [ethnicity, setEthnicity] = useState(restoredDraft?.ethnicity ?? '');
  const [householdSize, setHouseholdSize] = useState(restoredDraft?.householdSize ?? '');
  const [dietaryPattern, setDietaryPattern] = useState(restoredDraft?.dietaryPattern ?? '');
  const [dietaryOther, setDietaryOther] = useState(restoredDraft?.dietaryOther ?? '');
  const [smokerStatus, setSmokerStatus] = useState(restoredDraft?.smokerStatus ?? '');
  const [weeklyFoodSpend, setWeeklyFoodSpend] = useState(restoredDraft?.weeklyFoodSpend ?? '');
  const [occupationGroup, setOccupationGroup] = useState(restoredDraft?.occupationGroup ?? '');
  const [annualIncomeRange, setAnnualIncomeRange] = useState(restoredDraft?.annualIncomeRange ?? '');
  const [groceryRole, setGroceryRole] = useState(restoredDraft?.groceryRole ?? '');
  const [phone, setPhone] = useState(restoredDraft?.phone ?? '');
  const [addressLine1, setAddressLine1] = useState(restoredDraft?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(restoredDraft?.addressLine2 ?? '');
  const [city, setCity] = useState(restoredDraft?.city ?? '');
  const [region, setRegion] = useState(restoredDraft?.region ?? '');
  const [postalCode, setPostalCode] = useState(restoredDraft?.postalCode ?? '');
  const [country, setCountry] = useState(restoredDraft?.country ?? 'United Kingdom');
  const [consent, setConsent] = useState(restoredDraft?.consent ?? false);
  const [showConsentTerms, setShowConsentTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nationalityChoices = useMemo(() => nationalityOptions(), []);

  useEffect(() => {
    if (!user?.id || isProfileUpdate) return;
    savePanelistProfileDraft(window.sessionStorage, user.id, {
      name, birthMonth, birthYear, noKnownAllergies, allergenAvoidances,
      lactoseIntolerance, otherAvoidances, healthConsent, gender,
      genderSelfDescription, nationalityCode, ethnicity, householdSize,
      dietaryPattern, dietaryOther, smokerStatus, weeklyFoodSpend,
      occupationGroup, annualIncomeRange, groceryRole, phone, addressLine1,
      addressLine2, city, region, postalCode, country, consent,
    });
  }, [
    addressLine1, addressLine2, allergenAvoidances, annualIncomeRange, birthMonth,
    birthYear, city, consent, country, dietaryOther, dietaryPattern,
    ethnicity, gender, genderSelfDescription, groceryRole, healthConsent,
    householdSize, isProfileUpdate, lactoseIntolerance, name, nationalityCode,
    noKnownAllergies, occupationGroup, otherAvoidances, phone, postalCode, region,
    smokerStatus, user?.id, weeklyFoodSpend,
  ]);

  useEffect(() => {
    if (!ownProfile.data || hydratedProfile.current) return;
    hydratedProfile.current = true;
    const profile = ownProfile.data;
    setName(profile.name ?? '');
    setPhone(profile.phone ?? '');
    setAddressLine1(profile.addressLine1 ?? '');
    setAddressLine2(profile.addressLine2 ?? '');
    setCity(profile.city ?? '');
    setRegion(profile.region ?? '');
    setPostalCode(profile.postalCode ?? '');
    setCountry(profile.country ?? 'United Kingdom');
    setBirthMonth(profile.birthMonth?.toString() ?? '');
    setBirthYear(profile.birthYear?.toString() ?? '');
    setAllergenAvoidances(profile.allergenAvoidances);
    setLactoseIntolerance(profile.otherAvoidances.includes('lactose'));
    setOtherAvoidances(profile.otherAvoidances.filter(item => item !== 'lactose').join(', '));
    setNoKnownAllergies(profile.allergenAvoidances.length === 0 && profile.otherAvoidances.length === 0);
    setGender(profile.gender ?? '');
    setGenderSelfDescription(profile.genderSelfDescription ?? '');
    setNationalityCode(profile.nationalityCode ?? '');
    setEthnicity(ethnicityGroupForValue(profile.ethnicity));
    setHouseholdSize(profile.householdSizePreferNotToSay ? 'prefer_not_to_say' : profile.householdSize?.toString() ?? '');
    setDietaryPattern(profile.dietaryPattern ?? '');
    setDietaryOther(profile.dietaryOther ?? '');
    setGroceryRole(profile.groceryRole ?? '');
    setSmokerStatus(profile.smokerStatus ?? '');
    setWeeklyFoodSpend(profile.weeklyFoodSpend ?? '');
    setOccupationGroup(profile.occupationGroup ?? '');
    setAnnualIncomeRange(profile.annualIncomeRange ?? '');
  }, [ownProfile.data]);

  const allergySummary = useMemo(() => {
    if (noKnownAllergies) return 'No known food allergies or intolerances declared';
    const selected: string[] = ALLERGEN_OPTIONS.filter(option => allergenAvoidances.includes(option.code)).map(option => option.label);
    if (lactoseIntolerance) selected.push('Lactose intolerance');
    return [...selected, ...splitOtherAvoidances(otherAvoidances)].join(', ') || 'Not completed';
  }, [allergenAvoidances, lactoseIntolerance, noKnownAllergies, otherAvoidances]);

  const ageYears = useMemo(() => {
    if (!birthMonth || !birthYear) return null;
    const today = new Date();
    let age = today.getFullYear() - Number(birthYear);
    if (today.getMonth() + 1 < Number(birthMonth)) age -= 1;
    return age;
  }, [birthMonth, birthYear]);

  const validateStep = (targetStep: number) => {
    if (targetStep === 0) {
      if (name.trim().length < 2) return 'Enter your full name.';
      if (!isProfileUpdate) {
        const message = passwordError(password);
        if (message) return message;
        if (password !== confirmPassword) return 'The two passwords do not match.';
      }
    }
    if (targetStep === 1) {
      if (!birthMonth || !birthYear) return 'Enter your month and year of birth.';
      const latestPossibleBirth = new Date(Number(birthYear), Number(birthMonth), 0);
      const adultCutoff = new Date();
      adultCutoff.setFullYear(adultCutoff.getFullYear() - 18);
      if (latestPossibleBirth > adultCutoff) return 'Panel participation is limited to adults aged 18 or over.';
      if (ageYears != null && ageYears > 120) return 'Enter an age between 18 and 120.';
      if (!noKnownAllergies && allergenAvoidances.length === 0 && !lactoseIntolerance && splitOtherAvoidances(otherAvoidances).length === 0) return 'Declare your allergies or confirm that you have none.';
      if (!healthConsent) return 'Consent is required to use your allergy declaration for sample safety.';
    }
    if (targetStep === 2) {
      return panelistResearchProfileError({
        gender, genderSelfDescription, nationalityCode, ethnicity, dietaryPattern,
        dietaryOther, smokerStatus, weeklyFoodSpend, householdSizeChoice: householdSize,
        occupationGroup, annualIncomeRange, groceryRole,
      });
    }
    if (targetStep === 3) {
      if (phone.trim().length < 7) return 'Enter a valid phone number.';
      if (!addressLine1.trim() || !city.trim() || !postalCode.trim() || !country.trim()) return 'Complete the required delivery fields.';
    }
    return '';
  };

  const next = () => {
    const message = validateStep(step);
    setError(message);
    if (!message) {
      setStep(current => Math.min(current + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleAllergen = (code: AllergenCode) => {
    setNoKnownAllergies(false);
    setAllergenAvoidances(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (!consent) {
      setError('Accept the panelist consent terms to finish your account.');
      return;
    }
    for (const targetStep of [0, 1, 2, 3]) {
      const message = validateStep(targetStep);
      if (message) { setStep(targetStep); setError(message); return; }
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (!isProfileUpdate) {
        const { error: passwordUpdateError } = await supabase.auth.updateUser({ password });
        // The password can already have been saved by an earlier submission
        // whose profile RPC failed, or by a near-simultaneous double submit.
        // In that case the password step is complete and onboarding should
        // resume instead of trapping this first-time panelist.
        if (passwordUpdateError && !isSamePasswordAuthError(passwordUpdateError)) {
          throw passwordUpdateError;
        }
      }
      const declaredOtherAvoidances = [
        ...(lactoseIntolerance ? ['lactose'] : []),
        ...splitOtherAvoidances(otherAvoidances),
      ];
      await completePanelistProfile({
        name, phone, addressLine1, addressLine2, city, region, postalCode, country,
        consentVersion: CURRENT_CONSENT_VERSION,
        consentUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        birthMonth: Number(birthMonth), birthYear: Number(birthYear),
        allergenAvoidances: noKnownAllergies ? [] : allergenAvoidances,
        otherAvoidances: noKnownAllergies ? [] : Array.from(new Set(declaredOtherAvoidances)),
        healthConsentVersion: HEALTH_CONSENT_VERSION,
        gender: gender || null,
        genderSelfDescription: gender === 'self_describe' ? genderSelfDescription : null,
        nationalityCode: nationalityCode || null,
        ethnicity: ethnicity || null,
        householdSize: householdSize && householdSize !== 'prefer_not_to_say' ? Number(householdSize) : null,
        householdSizePreferNotToSay: householdSize === 'prefer_not_to_say',
        dietaryPattern: dietaryPattern || null,
        dietaryOther: dietaryPattern === 'other' ? dietaryOther : null,
        groceryRole: groceryRole || null,
        smokerStatus: smokerStatus || null,
        weeklyFoodSpend: weeklyFoodSpend || null,
        occupationGroup: occupationGroup || null,
        annualIncomeRange: annualIncomeRange || null,
      });
      if (user?.id) clearPanelistProfileDraft(window.sessionStorage, user.id);
      await refreshProfile();
      navigate('/panelist', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to finish your account.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl py-4 sm:py-8">
      <header className="mb-7 max-w-3xl">
        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white"><ShieldCheck className="size-5" aria-hidden /></div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Set up your panelist profile</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Complete your research and safety profile before joining any study. We use it to exclude unsuitable samples automatically and understand results across consumer groups.</p>
      </header>

      {restoredDraft && <Alert className="mb-5 max-w-3xl border-emerald-200 bg-emerald-50 text-emerald-950"><CheckCircle2 className="size-4" /><AlertDescription>Your saved answers have been restored. For security, re-enter your password before finishing.</AlertDescription></Alert>}

      <nav aria-label="Profile setup progress" className="mb-5 overflow-x-auto pb-1">
        <ol className="grid min-w-[620px] grid-cols-5 border-b border-slate-200">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const active = index === step;
            const complete = index < step;
            return <li key={item.label} className={`relative flex items-center gap-2 px-2 pb-3 text-xs font-semibold ${active ? 'text-slate-950' : complete ? 'text-emerald-700' : 'text-slate-400'}`}><span className={`flex size-7 items-center justify-center rounded-full border ${active ? 'border-slate-950 bg-slate-950 text-white' : complete ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'}`}>{complete ? <Check className="size-3.5" aria-hidden /> : <Icon className="size-3.5" aria-hidden />}</span>{item.label}{active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-slate-950" />}</li>;
          })}
        </ol>
      </nav>

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="p-5 sm:p-8">
          {step === 0 && <section aria-labelledby="account-heading" className="space-y-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 1 of 5</p><h2 id="account-heading" className="mt-1 text-xl font-bold text-slate-950">Account details</h2><p className="mt-1 text-sm leading-6 text-slate-600">{isProfileUpdate ? 'Confirm your account details before updating the rest of your panelist profile.' : 'Your invite is tied to this email. Create the password you will use when returning to studies. Your other answers are saved in this browser tab as you go; your password is never saved.'}</p></div>
            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-email">Invited email</Label><Input id="profile-email" value={user?.email ?? ''} disabled className="bg-slate-50" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-name">Full name</Label><Input id="profile-name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required /></div>
              {!isProfileUpdate && <><div className="space-y-1.5"><Label htmlFor="profile-password">Create password</Label><Input id="profile-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} /></div><div className="space-y-1.5"><Label htmlFor="profile-confirm-password">Confirm password</Label><Input id="profile-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} /></div></>}
            </div>
          </section>}

          {step === 1 && <section aria-labelledby="safety-heading" className="space-y-7">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 2 of 5</p><h2 id="safety-heading" className="mt-1 text-xl font-bold text-slate-950">Food safety declaration</h2><p className="mt-1 text-sm leading-6 text-slate-600">This information is used to exclude unsuitable samples automatically. Authorized study administrators may also review your declaration when preparing a study; each view is logged.</p></div>
            <div className="grid max-w-lg gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="birth-month">Month of birth</Label><select id="birth-month" value={birthMonth} onChange={event => setBirthMonth(event.target.value)} className={selectClassName}><option value="">Select month</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2000, index).toLocaleString('en-GB', { month: 'long' })}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="birth-year">Year of birth</Label><Input id="birth-year" inputMode="numeric" value={birthYear} onChange={event => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" /></div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Do you need to avoid any of these allergens?</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Select allergies, intolerances and medically required avoidances. We exclude both “contains” and “may contain” samples.</p>
              <label htmlFor="no-known-allergies" className={`mt-3 flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-sm font-medium ${noKnownAllergies ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-slate-200 text-slate-700'}`}><Checkbox id="no-known-allergies" checked={noKnownAllergies} onCheckedChange={value => { const checked = value === true; setNoKnownAllergies(checked); if (checked) { setAllergenAvoidances([]); setLactoseIntolerance(false); setOtherAvoidances(''); } }} /><span>No known food allergies or intolerances</span></label>
              <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <label htmlFor="avoid-lactose" className="flex cursor-pointer items-start gap-3 border-b border-slate-100 py-3"><Checkbox id="avoid-lactose" checked={lactoseIntolerance} onCheckedChange={value => { setLactoseIntolerance(value === true); if (value === true) setNoKnownAllergies(false); }} className="mt-0.5" /><span className="text-sm leading-5 text-slate-800"><strong className="font-medium">Lactose intolerance</strong><span className="block text-xs text-slate-500">Recorded separately from milk allergy</span></span></label>
                {ALLERGEN_OPTIONS.map(option => <label htmlFor={`avoid-${option.code}`} key={option.code} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 py-3"><Checkbox id={`avoid-${option.code}`} checked={allergenAvoidances.includes(option.code)} onCheckedChange={() => toggleAllergen(option.code)} className="mt-0.5" /><span className="text-sm leading-5 text-slate-800"><strong className="font-medium">{option.label}</strong>{'detail' in option && option.detail && <span className="block text-xs text-slate-500">{option.detail}</span>}</span></label>)}
              </div>
              <div className="mt-4 max-w-2xl space-y-1.5"><Label htmlFor="other-avoidances">Other food allergies or medical avoidances <span className="font-normal text-slate-500">(optional)</span></Label><Input id="other-avoidances" value={otherAvoidances} onChange={event => { setOtherAvoidances(event.target.value); if (event.target.value) setNoKnownAllergies(false); }} placeholder="For example: kiwi, buckwheat" /><p className="text-xs text-slate-500">Separate multiple items with commas.</p></div>
            </div>
            <label htmlFor="health-consent" className="flex cursor-pointer items-start gap-3 border-t border-slate-200 pt-5"><Checkbox id="health-consent" checked={healthConsent} onCheckedChange={value => setHealthConsent(value === true)} className="mt-0.5" /><span className="text-sm leading-6 text-slate-700">I explicitly consent to NFI using this health information to determine which product studies are safe for me, and to authorized study administrators viewing my declaration when needed to prepare or verify a study. Access is logged. I can update or withdraw my declaration by contacting the study team.</span></label>
          </section>}

          {step === 2 && <section aria-labelledby="demographics-heading" className="space-y-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 3 of 5</p><h2 id="demographics-heading" className="mt-1 text-xl font-bold text-slate-950">Research profile</h2><p className="mt-1 text-sm leading-6 text-slate-600">Complete the required selections before joining a study. Choose “Prefer not to say” whenever you do not want to provide an answer.</p></div>
            <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="gender">Gender</Label><select id="gender" value={gender} onChange={event => setGender(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{GENDER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              {gender === 'self_describe' && <div className="space-y-1.5"><Label htmlFor="gender-description">How do you describe your gender?</Label><Input id="gender-description" value={genderSelfDescription} onChange={event => setGenderSelfDescription(event.target.value)} maxLength={120} required /></div>}
              <div className="space-y-1.5"><Label htmlFor="nationality">Nationality</Label><select id="nationality" value={nationalityCode} onChange={event => setNationalityCode(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{nationalityChoices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
              <div className="space-y-1.5">
                <Label htmlFor="ethnicity">Ethnicity</Label>
                <select id="ethnicity" value={ethnicity} onChange={event => setEthnicity(event.target.value)} className={selectClassName} required>
                  <option value="">Choose an answer</option>
                  {ETHNICITY_GROUPS.map(group => <option key={group.value} value={group.value}>{group.label}</option>)}
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="dietary-pattern">Usual dietary pattern</Label><select id="dietary-pattern" value={dietaryPattern} onChange={event => setDietaryPattern(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{DIETARY_PATTERN_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              {dietaryPattern === 'other' && <div className="space-y-1.5"><Label htmlFor="dietary-other">Describe your dietary preference</Label><Input id="dietary-other" value={dietaryOther} onChange={event => setDietaryOther(event.target.value)} maxLength={160} required /></div>}
              <div className="space-y-1.5"><Label htmlFor="smoker-status">Smoker status</Label><select id="smoker-status" value={smokerStatus} onChange={event => setSmokerStatus(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{SMOKER_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="weekly-food-spend">Weekly food shop per person</Label><select id="weekly-food-spend" value={weeklyFoodSpend} onChange={event => setWeeklyFoodSpend(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{WEEKLY_FOOD_SHOP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="household-size">People in your household</Label><select id="household-size" value={householdSize} onChange={event => setHouseholdSize(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{HOUSEHOLD_SIZE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="occupation-group">Type of job</Label><select id="occupation-group" value={occupationGroup} onChange={event => setOccupationGroup(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{OCCUPATION_GROUP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="annual-income">Annual income range</Label><select id="annual-income" value={annualIncomeRange} onChange={event => setAnnualIncomeRange(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{ANNUAL_INCOME_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="grocery-role">Grocery shopping role</Label><select id="grocery-role" value={groceryRole} onChange={event => setGroceryRole(event.target.value)} className={selectClassName} required><option value="">Choose an answer</option>{GROCERY_ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
          </section>}

          {step === 3 && <section aria-labelledby="delivery-heading" className="space-y-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 4 of 5</p><h2 id="delivery-heading" className="mt-1 text-xl font-bold text-slate-950">Contact and delivery</h2><p className="mt-1 text-sm leading-6 text-slate-600">The study team uses these details for panelist coordination and tasting-box delivery.</p></div>
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-phone">Phone number</Label><Input id="profile-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" required /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-address-1">Address line 1</Label><Input id="profile-address-1" value={addressLine1} onChange={event => setAddressLine1(event.target.value)} autoComplete="address-line1" required /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="profile-address-2">Address line 2 <span className="font-normal text-slate-500">(optional)</span></Label><Input id="profile-address-2" value={addressLine2} onChange={event => setAddressLine2(event.target.value)} autoComplete="address-line2" /></div>
              <div className="space-y-1.5"><Label htmlFor="profile-city">Town or city</Label><Input id="profile-city" value={city} onChange={event => setCity(event.target.value)} autoComplete="address-level2" required /></div>
              <div className="space-y-1.5"><Label htmlFor="profile-region">County or region <span className="font-normal text-slate-500">(optional)</span></Label><Input id="profile-region" value={region} onChange={event => setRegion(event.target.value)} autoComplete="address-level1" /></div>
              <div className="space-y-1.5"><Label htmlFor="profile-postal-code">Postcode</Label><Input id="profile-postal-code" value={postalCode} onChange={event => setPostalCode(event.target.value)} autoComplete="postal-code" required /></div>
              <div className="space-y-1.5"><Label htmlFor="profile-country">Country</Label><Input id="profile-country" value={country} onChange={event => setCountry(event.target.value)} autoComplete="country-name" required /></div>
            </div>
          </section>}

          {step === 4 && <section aria-labelledby="review-heading" className="space-y-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 5 of 5</p><h2 id="review-heading" className="mt-1 text-xl font-bold text-slate-950">Review and finish</h2><p className="mt-1 text-sm leading-6 text-slate-600">Check the summary before activating your panelist account.</p></div>
            <dl className="max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
              <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium text-slate-500">Account</dt><dd className="text-sm text-slate-900">{name} · {user?.email}</dd></div>
              <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium text-slate-500">Safety declaration</dt><dd className="text-sm leading-6 text-slate-900">{allergySummary}<span className="block text-xs text-slate-500">Renews annually; unsafe samples are automatically excluded.</span></dd></div>
              <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium text-slate-500">Research profile</dt><dd className="text-sm leading-6 text-slate-900">Age {ageYears ?? 'not calculated'} · {nationalityChoices.find(option => option.value === nationalityCode)?.label ?? 'Nationality not selected'} · {ethnicityLabel(ethnicity)}<span className="block text-xs text-slate-500">Diet, household, smoking, shopping, occupation, and income selections completed.</span></dd></div>
              <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-sm font-medium text-slate-500">Delivery</dt><dd className="whitespace-pre-line text-sm leading-6 text-slate-900">{[addressLine1, addressLine2, `${city}${region ? `, ${region}` : ''}`, postalCode, country].filter(Boolean).join('\n')}</dd></div>
            </dl>
            <div className="flex max-w-3xl items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <Checkbox id="panelist-consent" checked={consent} onCheckedChange={value => setConsent(value === true)} className="mt-1" />
              <div>
                <label htmlFor="panelist-consent" className="cursor-pointer">I agree to the panelist consent terms and understand how my profile and research responses are used.</label>{' '}
                <button type="button" onClick={() => setShowConsentTerms(true)} className="font-semibold text-slate-950 underline underline-offset-2">Read consent terms</button>
              </div>
            </div>
            <p className="max-w-3xl text-xs leading-5 text-slate-500"><LockKeyhole className="mr-1 inline size-3.5" aria-hidden />Your allergy declaration drives automatic eligibility checks. Authorized study administrators can review it for safety planning, and every view is logged.</p>
          </section>}

          {error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Button type="button" variant="ghost" onClick={() => { setError(''); setStep(current => Math.max(0, current - 1)); }} disabled={step === 0 || busy}><ChevronLeft className="size-4" aria-hidden />Back</Button>
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs font-medium text-slate-500">{step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1 ? <Button type="button" onClick={next} className="bg-slate-950 hover:bg-slate-800">Continue<ChevronRight className="size-4" aria-hidden /></Button> : <Button type="submit" disabled={busy} className="bg-slate-950 hover:bg-slate-800"><CheckCircle2 className="size-4" aria-hidden />{busy ? 'Activating…' : 'Activate account'}</Button>}
          </div>
        </footer>
      </form>

      <Dialog open={showConsentTerms} onOpenChange={setShowConsentTerms}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-12">
            <DialogTitle>Panelist consent</DialogTitle>
            <DialogDescription>Review the terms, then return to the same signup step.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5 text-sm leading-6 text-slate-700">
            <PanelistConsentContent />
          </div>
          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <DialogClose asChild><Button type="button">Back to signup</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
