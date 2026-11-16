
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

/**
 * GLOBAL ONLINE VISA APPLICATIONS
 * COMPLETE CORRECTED V18 BACKEND
 *
 * Consultancy service fee: USD 285 per applicant.
 * Government visa fee: separate.
 * PRC is generated only after administrator approval.
 * No combined fee totals are calculated or returned.
 */

const VERSION = "visa-backend-v18";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID") ?? "";
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET") ?? "";
const GMAIL_REFRESH_TOKEN = Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "";
const GMAIL_SENDER_EMAIL = Deno.env.get("GMAIL_SENDER_EMAIL") ?? "";

const BUCKET = "Application-documents";
const SERVICE_FEE = 285;
const CURRENCY = "USD";
const MAX_APPLICANTS = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type Obj = Record<string, any>;

type AuthUser = {
  id: string;
  email: string | null;
};

type FeeRange = {
  official_fee_min: number;
  official_fee_max: number;
  service_fee: number;
  currency: string;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fail(message: string): never {
  throw new Error(message);
}

function str(value: unknown, name = "Value", max = 300): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max
  ) {
    fail(`${name} is required or invalid.`);
  }
  return value.trim();
}

function opt(value: unknown, max = 300): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.length > max) {
    fail("Invalid text value.");
  }
  return value.trim() || null;
}

function id(value: unknown, name = "ID"): string {
  const result = str(value, name, 36);
  const pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!pattern.test(result)) {
    fail(`${name} must be a valid UUID.`);
  }
  return result;
}

function email(value: unknown): string | null {
  const result = opt(value, 254);
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) {
    fail("Please provide a valid email address.");
  }
  return result;
}

function feeRange(visa: Obj): FeeRange {
  const rawMin = visa?.visa_fee_min;
  const rawMax = visa?.visa_fee_max;
  const min = Number(rawMin);
  const max = Number(rawMax);

  if (
    rawMin === null || rawMin === undefined || rawMin === "" ||
    rawMax === null || rawMax === undefined || rawMax === "" ||
    !Number.isFinite(min) || !Number.isFinite(max) ||
    min < 0 || max < min
  ) {
    fail(
      "The government visa fee range is not configured correctly. Please contact the administrator."
    );
  }

  return {
    official_fee_min: money(min),
    official_fee_max: money(max),
    service_fee: SERVICE_FEE,
    currency: CURRENCY,
  };
}

/* SUPABASE CLIENTS */

function clients(req: Request): {
  user: SupabaseClient;
  admin: SupabaseClient;
} {
  if (!URL || !ANON || !SERVICE) {
    fail("Supabase environment variables are not configured.");
  }

  const authorization = req.headers.get("Authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    fail("Please sign in first.");
  }

  const token = authorization.slice(7);

  const user = createClient(URL, ANON, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const admin = createClient(URL, SERVICE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { user, admin };
}

/* AUTHENTICATION */

async function authenticated(
  client: SupabaseClient
): Promise<AuthUser> {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    fail("Your session is invalid. Please sign in again.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}

async function requireAdmin(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data, error } = await admin
    .from("User_roles")
    .select('"User_id","Role"')
    .eq("User_id", userId)
    .maybeSingle();

  if (error) {
    fail("Could not verify administrator role.");
  }

  if (String(data?.Role ?? "").trim().toLowerCase() !== "admin") {
    fail("Administrator access required.");
  }
}

/* COUNTRY HELPERS */

function normalizeCountryName(value: string): string {
  const lower = value.trim().toLocaleLowerCase();

  const aliases: Record<string, string> = {
    "türkiye": "turkey",
    "turkiye": "turkey",
    "republic of türkiye": "turkey",
    "republic of turkey": "turkey",
  };

  return aliases[lower] ?? lower;
}

async function loadAllCountries(admin: SupabaseClient) {
  const countries: Obj[] = [];
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("countries")
      .select("id,country_name,country_code")
      .order("country_name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      fail(`Could not load countries: ${error.message}`);
    }

    const page = data ?? [];
    countries.push(...page);

    if (page.length < pageSize) break;
  }

  return {
    countries,
    country_count: countries.length,
  };
}

async function findCountryById(
  admin: SupabaseClient,
  countryId: string
) {
  const { data, error } = await admin
    .from("countries")
    .select("id,country_name,country_code")
    .eq("id", countryId)
    .maybeSingle();

  if (error) {
    fail(`Could not verify country: ${error.message}`);
  }
  if (!data) fail("Selected country was not found.");

  return data;
}

async function findCountryByName(
  admin: SupabaseClient,
  countryName: string
) {
  const { data, error } = await admin
    .from("countries")
    .select("id,country_name,country_code");

  if (error) {
    fail(`Could not search countries: ${error.message}`);
  }

  const target = normalizeCountryName(countryName);
  return (data ?? []).find(
    (country: Obj) =>
      normalizeCountryName(country.country_name) === target
  ) ?? null;
}

/* VISA TYPES */

async function visaTypes(admin: SupabaseClient, body: Obj) {
  const countryId = id(body.country_id, "country_id");

  const { data, error } = await admin
    .from("visa_types")
    .select(
      "id,country_id,visa_name,visa_fee,visa_fee_min,visa_fee_max,processing_days"
    )
    .eq("country_id", countryId)
    .order("visa_name", { ascending: true });

  if (error) {
    fail(`Could not load visa types: ${error.message}`);
  }

  const results = (data ?? []).map((visa: Obj) => ({
    id: visa.id,
    country_id: visa.country_id,
    visa_name: visa.visa_name,
    visa_fee: visa.visa_fee,
    processing_days: visa.processing_days,
    ...feeRange(visa),
  }));

  return {
    visa_types: results,
    service_fee_per_applicant: SERVICE_FEE,
    currency: CURRENCY,
  };
}

/* FILE HELPERS */

function decodeBase64(value: string): Uint8Array {
  const cleaned = value
    .replace(/^data:.*?;base64,/, "")
    .replace(/\s/g, "");

  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    fail("One of the uploaded files is not valid base64 data.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeFilename(value: unknown): string {
  const original = str(value, "File name", 180);
  const cleaned = original
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 140);

  if (!cleaned) fail("Invalid uploaded file name.");
  return cleaned;
}

/* APPLICANT PROFILE */

async function saveApplicant(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
  applicantData: Obj
): Promise<string> {
  const firstName = str(
    applicantData.first_name,
    "Applicant first name",
    100
  );

  const lastName = str(
    applicantData.last_name,
    "Applicant last name",
    100
  );

  const applicantEmail =
    email(applicantData.email) ?? userEmail;

  if (!applicantEmail) {
    fail("Applicant email address is required.");
  }

  const record: Obj = {
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    email: applicantEmail,
    phone: str(applicantData.phone, "Applicant phone", 40),
    date_of_birth: opt(applicantData.date_of_birth, 30),
    nationality: opt(applicantData.nationality, 100),
    passport_number: opt(applicantData.passport_number, 80),
  };

  const { data: existing, error: findError } = await admin
    .from("applicants")
    .select("id")
    .eq("user_id", userId)
    .eq("email", applicantEmail)
    .maybeSingle();

  if (findError) {
    fail(`Could not check applicant profile: ${findError.message}`);
  }

  if (existing?.id) {
    const { data, error } = await admin
      .from("applicants")
      .update(record)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !data) {
      fail(
        `Could not update applicant profile: ${error?.message ?? "Unknown error"}`
      );
    }
    return data.id;
  }

  const { data, error } = await admin
    .from("applicants")
    .insert(record)
    .select("id")
    .single();

  if (error || !data) {
    fail(
      `Could not create applicant profile: ${error?.message ?? "Unknown error"}`
    );
  }
  return data.id;
}

/* DOCUMENT UPLOADS */

async function uploadDocs(
  admin: SupabaseClient,
  applicationId: string,
  applicantId: string,
  userId: string,
  files: unknown
): Promise<Obj[]> {
  if (files === undefined || files === null) return [];

  if (!Array.isArray(files)) {
    fail("Documents must be supplied as a list.");
  }
  if (files.length > 20) {
    fail("A maximum of 20 documents can be uploaded per application.");
  }

  const uploaded: Obj[] = [];

  for (const file of files as Obj[]) {
    const filename = safeFilename(file.file_name);
    const contentType =
      opt(file.content_type, 120) ?? "application/octet-stream";
    const documentType =
      opt(file.document_type, 80) ?? "Other";

    const base64 = str(file.base64, "Document content", 15_000_000);
    const bytes = decodeBase64(base64);

    if (bytes.length === 0) fail(`${filename} is empty.`);
    if (bytes.length > MAX_FILE_SIZE) {
      fail(`${filename} exceeds the 8 MB file limit.`);
    }

    const storagePath =
      `${applicationId}/${crypto.randomUUID()}-${filename}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      fail(`Could not upload ${filename}: ${uploadError.message}`);
    }

    const { data, error: insertError } = await admin
      .from("application_documents")
      .insert({
        application_id: applicationId,
        applicant_id: applicantId,
        document_type: documentType,
        storage_path: storagePath,
        file_name: filename,
        file_path: storagePath,
        original_file_name: filename,
        mime_type: contentType,
        content_type: contentType,
        file_size: bytes.length,
        uploaded_by: userId,
      })
      .select("id,file_name,created_at")
      .single();

    if (insertError || !data) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      fail(
        `Could not save document record: ${insertError?.message ?? "Unknown error"}`
      );
    }

    uploaded.push(data);
  }

  return uploaded;
}

/* EMAIL QUEUE INSERTION */

async function queueEmail(
  admin: SupabaseClient,
  recipient: string | null,
  eventType: string,
  applicationId: string | null,
  payload: Obj = {}
): Promise<void> {
  if (!recipient) return;

  const now = new Date().toISOString();

  const { error } = await admin
    .from("email_queue")
    .insert({
      recipient_email: recipient,
      event_type: eventType,
      application_id: applicationId,
      payload,
      status: "pending",
      attempts: 0,
      created_at: now,
      updated_at: now,
      scheduled_for: now,
    });

  if (error) {
    console.error("Email queue insertion failed:", error.message);
  }
}

async function notifyAdmins(
  admin: SupabaseClient,
  eventType: string,
  applicationId: string | null,
  payload: Obj = {}
): Promise<void> {
  const { data: roles, error } = await admin
    .from("User_roles")
    .select('"User_id","Role"');

  if (error) {
    console.error("Could not load administrator accounts:", error.message);
    return;
  }

  for (const role of roles ?? []) {
    if (
      !role.User_id ||
      String(role.Role ?? "").trim().toLowerCase() !== "admin"
    ) continue;

    const { data, error: userError } =
      await admin.auth.admin.getUserById(role.User_id);

    if (userError) {
      console.error("Could not load administrator email:", userError.message);
      continue;
    }

    await queueEmail(
      admin,
      data.user?.email ?? null,
      eventType,
      applicationId,
      payload
    );
  }
}

/* APPLYING-FROM COUNTRY */

async function resolveApplyingFrom(
  admin: SupabaseClient,
  body: Obj
): Promise<Obj> {
  const countryId = opt(body.applying_from_country_id, 36);

  if (countryId) {
    return await findCountryById(
      admin,
      id(countryId, "Applying-from country ID")
    );
  }

  const countryName = str(
    body.applying_from,
    "Country applying from",
    120
  );

  const country = await findCountryByName(admin, countryName);

  return country ?? {
    id: null,
    country_name: countryName,
    country_code: null,
  };
}

/* SUBMIT APPLICATIONS */

async function submit(
  admin: SupabaseClient,
  currentUser: AuthUser,
  body: Obj
): Promise<Obj> {
  const destinationCountryId = id(
    body.destination_country_id,
    "Destination country"
  );

  const visaTypeId = id(body.visa_type_id, "Visa type");

  const destination = await findCountryById(
    admin,
    destinationCountryId
  );

  const applyingFrom = await resolveApplyingFrom(admin, body);

  const { data: visa, error: visaError } = await admin
    .from("visa_types")
    .select(
      "id,country_id,visa_name,visa_fee,visa_fee_min,visa_fee_max,processing_days"
    )
    .eq("id", visaTypeId)
    .eq("country_id", destinationCountryId)
    .maybeSingle();

  if (visaError) {
    fail(`Could not verify visa type: ${visaError.message}`);
  }
  if (!visa) {
    fail("The selected visa type does not belong to the selected destination country.");
  }

  const configuredFees = feeRange(visa);

  if (
    !Array.isArray(body.applicants) ||
    body.applicants.length < 1 ||
    body.applicants.length > MAX_APPLICANTS
  ) {
    fail(`Please provide between 1 and ${MAX_APPLICANTS} applicants.`);
  }

  const preferredCountries = opt(body.preferred_countries, 2000);
  const suggestedCountries = opt(body.suggested_countries, 2000);
  const created: Obj[] = [];

  for (let index = 0; index < body.applicants.length; index++) {
    const applicantData = body.applicants[index];

    const applicantId = await saveApplicant(
      admin,
      currentUser.id,
      currentUser.email ?? "",
      applicantData
    );

    const referenceNumber =
      `GOVA-${new Date().getFullYear()}-${crypto.randomUUID()
        .replace(/-/g, "")
        .slice(0, 10)
        .toUpperCase()}`;

    const applicationRecord: Obj = {
      applicant_id: applicantId,
      visa_type_id: visaTypeId,
      application_date: new Date().toISOString(),
      status: "Pending",
      "Preferred countries": preferredCountries,
      Suggested_countries: suggestedCountries,
      destination_country_id: destinationCountryId,
      service_fee: SERVICE_FEE,
      reference_number: referenceNumber,
      payment_status: "Pending",
      official_visa_fee: visa.visa_fee ?? null,
      currency: CURRENCY,
      applying_from: applyingFrom.country_name,
      applying_from_country_id: applyingFrom.id ?? null,
      service_fee_payment_status: "pending",
      visa_fee_payment_status: "pending",
    };

    const { data: application, error: applicationError } =
      await admin
        .from("visa_applications")
        .insert(applicationRecord)
        .select("id,reference_number,status,created_at")
        .single();

    if (applicationError || !application) {
      fail(
        `Could not create application: ${applicationError?.message ?? "Unknown error"}`
      );
    }

    const documents = await uploadDocs(
      admin,
      application.id,
      applicantId,
      currentUser.id,
      applicantData.documents ?? (index === 0 ? body.documents : [])
    );

    const applicantEmail =
      email(applicantData.email) ?? currentUser.email;

    const emailPayload = {
      reference_number: application.reference_number,
      applicant_name: [
        applicantData.first_name,
        applicantData.last_name,
      ].filter(Boolean).join(" "),
      applicant_email: applicantEmail,
      destination_country: destination.country_name,
      applying_from: applyingFrom.country_name,
      visa_type: visa.visa_name,
      processing_days: visa.processing_days,
      service_fee: SERVICE_FEE,
      currency: CURRENCY,
      official_visa_fee_min: configuredFees.official_fee_min,
      official_visa_fee_max: configuredFees.official_fee_max,
      service_fee_payment_status: "pending",
      visa_fee_payment_status: "pending",
    };

    await queueEmail(
      admin,
      applicantEmail,
      "application_submitted",
      application.id,
      emailPayload
    );

    await notifyAdmins(
      admin,
      "admin_new_application",
      application.id,
      emailPayload
    );

    created.push({
      id: application.id,
      reference_number: application.reference_number,
      status: application.status,
      applicant_id: applicantId,
      documents,
      service_fee: SERVICE_FEE,
      currency: CURRENCY,
      official_visa_fee_min: configuredFees.official_fee_min,
      official_visa_fee_max: configuredFees.official_fee_max,
      processing_days: visa.processing_days,
      service_fee_payment_status: "pending",
      visa_fee_payment_status: "pending",
    });
  }

  return {
    message: "Application submitted successfully.",
    applications: created,
    applicants_count: created.length,
    service_fee_per_applicant: SERVICE_FEE,
    currency: CURRENCY,
  };
}

/* DRAFTS */

async function saveDraft(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
  body: Obj
): Promise<Obj> {
  const draft = body.draft;

  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    fail("A valid draft is required.");
  }

  const draftId = opt(body.draft_id, 36);
  const draftEmail = email(body.email) ?? email(userEmail);

  if (!draftEmail) {
    fail("A valid email address is required to save a draft.");
  }

  const record = {
    user_id: userId,
    email: draftEmail,
    draft_data: draft,
    last_activity_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (draftId) {
    const { data, error } = await admin
      .from("application_drafts")
      .update(record)
      .eq("id", id(draftId, "Draft ID"))
      .eq("user_id", userId)
      .select("id,created_at,updated_at")
      .maybeSingle();

    if (error) fail(`Could not update draft: ${error.message}`);
    if (!data) {
      fail("Draft not found or you do not have permission to update it.");
    }

    return { ...data, message: "Draft updated." };
  }

  const { data, error } = await admin
    .from("application_drafts")
    .insert({
      ...record,
      created_at: new Date().toISOString(),
    })
    .select("id,created_at,updated_at")
    .single();

  if (error || !data) {
    fail(`Could not save draft: ${error?.message ?? "Unknown error"}`);
  }

  return { ...data, message: "Draft saved." };
}

async function myDrafts(
  admin: SupabaseClient,
  userId: string
): Promise<Obj> {
  const { data, error } = await admin
    .from("application_drafts")
    .select("id,draft_data,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) fail(`Could not load drafts: ${error.message}`);

  return {
    drafts: data ?? [],
    count: data?.length ?? 0,
  };
}

/* ENQUIRIES */

async function createEnquiry(
  admin: SupabaseClient,
  currentUser: AuthUser,
  body: Obj
): Promise<Obj> {
  const subject = str(body.subject, "Enquiry subject", 180);
  const message = str(body.message, "Enquiry message", 2000);
  const contactEmail = email(body.email) ?? currentUser.email;

  if (!contactEmail) fail("A valid email address is required.");
  if (body.consent !== true) {
    fail("Please provide consent before submitting your enquiry.");
  }

  const { data, error } = await admin
    .from("enquiries")
    .insert({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      full_name: opt(body.full_name ?? body.name, 100) ?? "Website visitor",
      name: opt(body.name, 160),
      email: contactEmail,
      phone: opt(body.phone, 40),
      destination: opt(body.destination, 160) ?? "Not specified",
      purpose: opt(body.purpose, 160) ?? subject,
      subject,
      message,
      consent: true,
      status: "New",
      created_at: new Date().toISOString(),
    })
    .select("id,subject,status,created_at")
    .single();

  if (error || !data) {
    fail(`Could not submit enquiry: ${error?.message ?? "Unknown error"}`);
  }

  await notifyAdmins(admin, "admin_new_enquiry", null, {
    enquiry_id: data.id,
    subject,
    sender_email: contactEmail,
  });

  return {
    message: "Your enquiry has been submitted.",
    enquiry: data,
  };
}

/* APPLICATION ENRICHMENT */

async function countryNameMap(
  admin: SupabaseClient,
  countryIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(countryIds.filter(Boolean))];
  const result = new Map<string, string>();

  if (!uniqueIds.length) return result;

  const { data, error } = await admin
    .from("countries")
    .select("id,country_name")
    .in("id", uniqueIds);

  if (error) {
    fail(`Could not load country names: ${error.message}`);
  }

  for (const country of data ?? []) {
    result.set(country.id, country.country_name);
  }

  return result;
}

async function enrichApplications(
  admin: SupabaseClient,
  applications: Obj[]
): Promise<Obj[]> {
  if (!applications.length) return [];

  const applicantIds = [
    ...new Set(applications.map((x) => x.applicant_id).filter(Boolean)),
  ];

  const visaTypeIds = [
    ...new Set(applications.map((x) => x.visa_type_id).filter(Boolean)),
  ];

  const countryIds = applications.flatMap((x) => [
    x.destination_country_id,
    x.applying_from_country_id,
  ]).filter(Boolean);

  const { data: applicants, error: applicantError } =
    applicantIds.length
      ? await admin
          .from("applicants")
          .select(
            "id,first_name,last_name,email,phone,nationality,passport_number"
          )
          .in("id", applicantIds)
      : { data: [], error: null };

  if (applicantError) {
    fail(`Could not load applicants: ${applicantError.message}`);
  }

  const { data: visas, error: visaError } = visaTypeIds.length
    ? await admin
        .from("visa_types")
        .select("id,visa_name,processing_days,visa_fee_min,visa_fee_max")
        .in("id", visaTypeIds)
    : { data: [], error: null };

  if (visaError) {
    fail(`Could not load visa types: ${visaError.message}`);
  }

  const names = await countryNameMap(admin, countryIds);

  const applicantMap = new Map(
    (applicants ?? []).map((item) => [item.id, item])
  );

  const visaMap = new Map(
    (visas ?? []).map((item) => [item.id, item])
  );

  return applications.map((application) => {
    const applicant = applicantMap.get(application.applicant_id);
    const visa = visaMap.get(application.visa_type_id);

    return {
      ...application,
      applicant: applicant ?? null,
      applicant_name: applicant
        ? [applicant.first_name, applicant.last_name]
            .filter(Boolean).join(" ")
        : null,
      visa_type: visa?.visa_name ?? null,
      processing_days: visa?.processing_days ?? null,
      official_visa_fee_min: visa?.visa_fee_min ?? null,
      official_visa_fee_max: visa?.visa_fee_max ?? null,
      destination_country:
        names.get(application.destination_country_id) ?? null,
      applying_from_country:
        names.get(application.applying_from_country_id) ??
        application.applying_from ??
        null,
      service_fee: application.service_fee ?? SERVICE_FEE,
      currency: application.currency ?? CURRENCY,
      service_fee_payment_status:
        application.service_fee_payment_status ?? "pending",
      visa_fee_payment_status:
        application.visa_fee_payment_status ?? "pending",
    };
  });
}

/* CUSTOMER APPLICATIONS */

async function myApplications(
  admin: SupabaseClient,
  userId: string
): Promise<Obj> {
  const { data: applicants, error: applicantError } = await admin
    .from("applicants")
    .select("id")
    .eq("user_id", userId);

  if (applicantError) {
    fail(`Could not load applicant profiles: ${applicantError.message}`);
  }

  const applicantIds = (applicants ?? []).map((item) => item.id);

  if (!applicantIds.length) {
    return { applications: [], count: 0 };
  }

  const { data, error } = await admin
    .from("visa_applications")
    .select(
      "id,applicant_id,visa_type_id,application_date,created_at,status,reference_number,destination_country_id,applying_from,applying_from_country_id,service_fee,official_visa_fee,currency,payment_status,service_fee_payment_status,visa_fee_payment_status,payment_confirmed_at"
    )
    .in("applicant_id", applicantIds)
    .order("created_at", { ascending: false });

  if (error) fail(`Could not load applications: ${error.message}`);

  const applications = await enrichApplications(admin, data ?? []);
  return { applications, count: applications.length };
}

/* ADMIN LISTS */

async function adminApplications(admin: SupabaseClient): Promise<Obj> {
  const { data, error } = await admin
    .from("visa_applications")
    .select(
      "id,applicant_id,visa_type_id,application_date,created_at,status,reference_number,destination_country_id,applying_from,applying_from_country_id,service_fee,official_visa_fee,currency,payment_status,service_fee_payment_status,visa_fee_payment_status,payment_confirmed_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    fail(`Could not load admin applications: ${error.message}`);
  }

  const applications = await enrichApplications(admin, data ?? []);
  return { applications, count: applications.length };
}

async function adminPayments(admin: SupabaseClient): Promise<Obj> {
  const { data, error } = await admin
    .from("payments")
    .select("id,application_id,amount,payment_status,payment_date,payment_type,prc_code,prc_generated_at")
    .order("payment_date", { ascending: false });

  if (error) fail(`Could not load payments: ${error.message}`);

  return { payments: data ?? [], count: data?.length ?? 0 };
}

async function adminEnquiries(admin: SupabaseClient): Promise<Obj> {
  const { data, error } = await admin
    .from("enquiries")
    .select(
      "id,user_id,full_name,destination,purpose,consent,name,email,phone,subject,message,status,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) fail(`Could not load enquiries: ${error.message}`);

  return { enquiries: data ?? [], count: data?.length ?? 0 };
}

async function adminNotifications(admin: SupabaseClient): Promise<Obj> {
  const { data, error } = await admin
    .from("email_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    fail(`Could not load email notifications: ${error.message}`);
  }

  return { notifications: data ?? [], count: data?.length ?? 0 };
}

/* ADMIN: UPDATE APPLICATION STATUS */

async function updateStatus(
  admin: SupabaseClient,
  body: Obj
): Promise<Obj> {
  const applicationId = id(body.application_id, "Application ID");

  const allowedStatuses = [
    "Pending",
    "Under Review",
    "Documents Verified",
    "Processing",
    "Approved",
    "Rejected",
  ];

  const newStatus = str(body.status, "Application status", 50);

  if (!allowedStatuses.includes(newStatus)) {
    fail("Invalid application status.");
  }

  const { data: existing, error: findError } = await admin
    .from("visa_applications")
    .select("id,status,service_fee_payment_status,reference_number")
    .eq("id", applicationId)
    .maybeSingle();

  if (findError) {
    fail(`Could not load application: ${findError.message}`);
  }
  if (!existing) fail("Application not found.");

  if (
    newStatus === "Processing" &&
    String(existing.service_fee_payment_status).toLowerCase() !== "paid"
  ) {
    fail(
      "The application cannot enter Processing until the USD $285 consultancy service fee is confirmed as paid."
    );
  }

  let query = admin
    .from("visa_applications")
    .update({ status: newStatus })
    .eq("id", applicationId);

  if (newStatus === "Processing") {
    query = query.eq("service_fee_payment_status", "paid");
  }

  const { data, error } = await query
    .select("id,status,reference_number")
    .maybeSingle();

  if (error) {
    fail(`Could not update application status: ${error.message}`);
  }
  if (!data) {
    fail(
      "Application status was not changed. Check the service fee payment status and try again."
    );
  }

  return {
    message: "Application status updated.",
    application: data,
    previous_status: existing.status,
  };
}

/* ADMIN: DOCUMENTS */

async function adminDocuments(
  admin: SupabaseClient,
  body: Obj
): Promise<Obj> {
  let query = admin
    .from("application_documents")
    .select("*")
    .order("created_at", { ascending: false });

  const applicationId = opt(body.application_id, 36);

  if (applicationId) {
    query = query.eq("application_id", id(applicationId, "Application ID"));
  }

  const { data, error } = await query;

  if (error) fail(`Could not load documents: ${error.message}`);

  return { documents: data ?? [], count: data?.length ?? 0 };
}

async function downloadDocument(
  admin: SupabaseClient,
  body: Obj
): Promise<Obj> {
  const documentId = id(body.document_id, "Document ID");

  const { data: document, error: findError } = await admin
    .from("application_documents")
    .select("id,application_id,storage_path,file_name")
    .eq("id", documentId)
    .maybeSingle();

  if (findError) {
    fail(`Could not find document: ${findError.message}`);
  }
  if (!document) fail("Document not found.");
  if (!document.storage_path) fail("Document storage path is missing.");

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, 300);

  if (error || !data?.signedUrl) {
    fail(
      `Could not create secure download link: ${error?.message ?? "Unknown error"}`
    );
  }

  return {
    document_id: document.id,
    application_id: document.application_id,
    file_name: document.file_name,
    download_url: data.signedUrl,
    expires_in_seconds: 300,
  };
}

/* ADMIN: CONFIRM PAYMENTS AND GENERATE PRC */

async function confirmPayment(
  admin: SupabaseClient,
  body: Obj,
  adminUserId: string
): Promise<Obj> {
  const applicationId = id(body.application_id, "Application ID");
  const paymentType = str(body.payment_type, "Payment type", 30).toLowerCase();

  if (paymentType !== "service_fee" && paymentType !== "visa_fee") {
    fail("Payment type must be service_fee or visa_fee.");
  }

  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    fail("Enter a valid positive payment amount.");
  }

  const currency = str(body.currency ?? CURRENCY, "Currency", 10).toUpperCase();

  if (currency !== CURRENCY) {
    fail("Payments must be recorded in USD.");
  }

  /*
   * The database function verifies the administrator,
   * validates the payment amount, prevents duplicate approvals,
   * records the payment and generates the PRC.
   *
   * The PRC is therefore NOT generated when an applicant
   * submits an application or merely reports a payment.
   */
  const { data, error } = await admin.rpc(
    "admin_approve_payment_with_prc",
    {
      p_application_id: applicationId,
      p_payment_type: paymentType,
      p_amount: money(amount),
      p_admin_user_id: adminUserId,
    }
  );

  if (error) {
    fail(`Payment approval failed: ${error.message}`);
  }

  if (!data?.success) {
    fail(data?.message ?? "Payment approval was not completed.");
  }

  return {
    message: "Payment approved successfully.",
    payment: data.payment ?? null,
    prc_code: data.prc_code ?? null,
    already_approved: data.already_approved ?? false,
  };
}

/* EMAIL HELPERS */

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not specified";
  return `USD ${amount.toFixed(2)}`;
}

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeText(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `=?UTF-8?B?${btoa(binary)}?=`;
}

async function getGmailAccessToken(): Promise<string> {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    fail("Gmail API credentials are not configured.");
  }

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    }
  );

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    fail(
      `Gmail authentication failed: ${result.error_description ?? result.error ?? "Unknown error"}`
    );
  }

  return result.access_token;
}

async function sendGmail(
  recipient: string,
  subject: string,
  html: string
): Promise<void> {
  if (!GMAIL_SENDER_EMAIL) {
    fail("Gmail sender email is not configured.");
  }

  const token = await getGmailAccessToken();
  const safeRecipient = email(recipient);

  if (!safeRecipient) fail("Invalid email recipient.");

  const message = [
    `From: ${GMAIL_SENDER_EMAIL}`,
    `To: ${safeRecipient}`,
    `Subject: ${encodeText(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
  ].join("\r\n");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64Url(message) }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    fail(`Gmail delivery failed: ${details.slice(0, 1000)}`);
  }
}

function emailLayout(heading: string, content: string): string {
  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
  </head>
  <body style="margin:0;padding:20px;background:#f3f6fa;font-family:Arial,sans-serif;color:#243247">
    <div style="max-width:680px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden">
      <div style="background:#12345a;padding:25px;color:#ffffff">
        <h2 style="margin:0">Global Online Visa Applications</h2>
        <p style="margin:8px 0 0">Application notification</p>
      </div>
      <div style="padding:25px">
        <h2 style="color:#12345a">${escapeHtml(heading)}</h2>
        ${content}
      </div>
      <div style="padding:18px 25px;background:#f3f6fa;font-size:12px;color:#64748b">
        This is an automated notification from Global Online Visa Applications.
        Please do not reply to this automated email.
      </div>
    </div>
  </body>
  </html>`;
}

function detailsTable(rows: Array<[string, unknown]>): string {
  return `
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5eaf0;font-weight:bold">
            ${escapeHtml(label)}
          </td>
          <td style="padding:10px;border-bottom:1px solid #e5eaf0">
            ${escapeHtml(value)}
          </td>
        </tr>
      `).join("")}
    </table>`;
}

/* EMAIL APPLICATION DETAILS */

async function loadApplication(
  admin: SupabaseClient,
  applicationId: string
): Promise<Obj> {
  const { data: application, error } = await admin
    .from("visa_applications")
    .select(
      "id,applicant_id,visa_type_id,application_date,created_at,status,reference_number,destination_country_id,applying_from,applying_from_country_id,service_fee,official_visa_fee,currency,service_fee_payment_status,visa_fee_payment_status"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !application) {
    fail(
      `Could not load application for email: ${error?.message ?? "Application not found"}`
    );
  }

  const { data: applicant } = await admin
    .from("applicants")
    .select("first_name,last_name,email,phone")
    .eq("id", application.applicant_id)
    .maybeSingle();

  const { data: visa } = await admin
    .from("visa_types")
    .select("visa_name,processing_days,visa_fee_min,visa_fee_max")
    .eq("id", application.visa_type_id)
    .maybeSingle();

  const destination = application.destination_country_id
    ? await findCountryById(admin, application.destination_country_id)
    : null;

  const applyingFrom = application.applying_from_country_id
    ? await findCountryById(admin, application.applying_from_country_id)
    : null;

  return {
    ...application,
    applicant,
    applicant_name: applicant
      ? [applicant.first_name, applicant.last_name].filter(Boolean).join(" ")
      : "Applicant",
    visa_name: visa?.visa_name ?? "Not specified",
    processing_days: visa?.processing_days ?? null,
    official_visa_fee_min: visa?.visa_fee_min ?? null,
    official_visa_fee_max: visa?.visa_fee_max ?? null,
    destination_country: destination?.country_name ?? "Not specified",
    applying_from_country:
      applyingFrom?.country_name ??
      application.applying_from ??
      "Not specified",
  };
}

function makeEmail(eventType: string, payload: Obj): Obj {
  const reference = payload.reference_number ?? "Not available";
  const applicantName = payload.applicant_name ?? "Applicant";
  const destination = payload.destination_country ?? "Not specified";
  const applyingFrom = payload.applying_from ?? "Not specified";
  const visaType = payload.visa_type ?? "Not specified";

  const processingDays = payload.processing_days == null
    ? "Not specified"
    : `${payload.processing_days} days`;

  const serviceFee = emailMoney(payload.service_fee ?? SERVICE_FEE);
  const feeMin = emailMoney(payload.official_visa_fee_min);
  const feeMax = emailMoney(payload.official_visa_fee_max);

  const serviceStatus = payload.service_fee_payment_status ?? "pending";
  const visaStatus = payload.visa_fee_payment_status ?? "pending";

  const commonRows: Array<[string, unknown]> = [
    ["Reference number", reference],
    ["Applicant", applicantName],
    ["Destination country", destination],
    ["Applying from", applyingFrom],
    ["Visa type", visaType],
    ["Processing days", processingDays],
    ["Consultancy service fee", serviceFee],
    ["Government visa fee minimum", feeMin],
    ["Government visa fee maximum", feeMax],
    ["Service fee payment status", serviceStatus],
    ["Government visa fee payment status", visaStatus],
  ];

  if (eventType === "application_submitted") {
    return {
      subject: `Application received — ${reference}`,
      html: emailLayout(
        "Your visa application has been received",
        `
          <p>Hello ${escapeHtml(applicantName)},</p>
          <p>Thank you for submitting your application. We have received it successfully.</p>
          ${detailsTable(commonRows)}
          <p>Your application is currently pending review.</p>
          <p>Please keep your reference number for future tracking.</p>
        `
      ),
    };
  }

  if (eventType === "admin_new_application") {
    return {
      subject: `New visa application — ${reference}`,
      html: emailLayout(
        "New application received",
        `
          <p>A new visa application has been submitted.</p>
          ${detailsTable([
            ...commonRows,
            ["Applicant email", payload.applicant_email ?? "Not supplied"],
          ])}
        `
      ),
    };
  }

  if (eventType === "application_status_changed") {
    return {
      subject: `Application status update — ${reference}`,
      html: emailLayout(
        "Your application status has changed",
        `
          <p>Hello ${escapeHtml(applicantName)},</p>
          <p>Your application status has been updated.</p>
          ${detailsTable([
            ["Reference number", reference],
            ["Previous status", payload.previous_status ?? "Not available"],
            ["New status", payload.new_status ?? "Not available"],
            ["Destination country", destination],
            ["Visa type", visaType],
          ])}
        `
      ),
    };
  }

  if (eventType === "admin_new_enquiry") {
    return {
      subject: `New customer enquiry — ${payload.subject ?? ""}`,
      html: emailLayout(
        "New customer enquiry",
        detailsTable([
          ["Enquiry ID", payload.enquiry_id ?? ""],
          ["Subject", payload.subject ?? ""],
          ["Sender email", payload.sender_email ?? ""],
        ])
      ),
    };
  }

  return {
    subject: "Global Online Visa Applications notification",
    html: emailLayout(
      "Application notification",
      "<p>You have a new notification.</p>"
    ),
  };
}

/* QUEUE STATUS EMAIL */

async function queueStatusEmail(
  admin: SupabaseClient,
  applicationId: string,
  previousStatus: string,
  newStatus: string
): Promise<void> {
  const application = await loadApplication(admin, applicationId);
  const recipient = email(application.applicant?.email);

  if (!recipient) return;

  await queueEmail(
    admin,
    recipient,
    "application_status_changed",
    applicationId,
    {
      reference_number: application.reference_number,
      applicant_name: application.applicant_name,
      destination_country: application.destination_country,
      visa_type: application.visa_name,
      previous_status: previousStatus,
      new_status: newStatus,
      processing_days: application.processing_days,
    }
  );
}

/* PROCESS EMAIL QUEUE */

async function processEmailQueue(
  admin: SupabaseClient
): Promise<Obj> {
  const { data: pending, error } = await admin
    .from("email_queue")
    .select("id,recipient_email,event_type,application_id,payload,attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    fail(`Could not load email queue: ${error.message}`);
  }

  let sent = 0;
  let failed = 0;

  for (const item of pending ?? []) {
    const { data: locked, error: lockError } = await admin
      .from("email_queue")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (lockError || !locked) continue;

    try {
      const emailContent = makeEmail(item.event_type, item.payload ?? {});

      await sendGmail(
        item.recipient_email,
        emailContent.subject,
        emailContent.html
      );

      const { error: sentError } = await admin
        .from("email_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          attempts: Number(item.attempts ?? 0) + 1,
          last_error: null,
        })
        .eq("id", item.id);

      if (sentError) throw new Error(sentError.message);
      sent++;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : String(error);

      await admin
        .from("email_queue")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          attempts: Number(item.attempts ?? 0) + 1,
          last_error: message.slice(0, 1000),
        })
        .eq("id", item.id);

      failed++;
    }
  }

  return {
    checked: pending?.length ?? 0,
    sent,
    failed,
  };
}

/* MAIN API ROUTER */

function jsonResponse(payload: Obj, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: cors,
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      ok: false,
      error: "Method not allowed. Use POST.",
      version: VERSION,
    }, 405);
  }

  try {
    const clientSet = clients(req);
    const userClient = clientSet.user;
    const admin = clientSet.admin;

    const currentUser = await authenticated(userClient);
    const body = await req.json() as Obj;

    const action = str(body.action, "Action", 80);

    let result: Obj = {};
    let emailDelivery: Obj | null = null;

    switch (action) {
      case "countries": {
        result = await loadAllCountries(admin);
        break;
      }

      case "visa_types": {
        result = await visaTypes(admin, body);
        break;
      }

      case "submit": {
        result = await submit(admin, currentUser, body);
        break;
      }

      case "save_draft": {
        result = await saveDraft(
          admin,
          currentUser.id,
          currentUser.email ?? "",
          body
        );
        break;
      }

      case "my_drafts": {
        result = await myDrafts(admin, currentUser.id);
        break;
      }

      case "create_enquiry": {
        result = await createEnquiry(admin, currentUser, body);
        break;
      }

      case "my_applications": {
        result = await myApplications(admin, currentUser.id);
        break;
      }

      case "admin_applications":
      case "admin_payments":
      case "admin_enquiries":
      case "admin_notifications":
      case "admin_update_status":
      case "admin_documents":
      case "download_document":
      case "admin_confirm_payment": {
        await requireAdmin(admin, currentUser.id);

        if (action === "admin_applications") {
          result = await adminApplications(admin);
        }

        if (action === "admin_payments") {
          result = await adminPayments(admin);
        }

        if (action === "admin_enquiries") {
          result = await adminEnquiries(admin);
        }

        if (action === "admin_notifications") {
          result = await adminNotifications(admin);
        }

        if (action === "admin_update_status") {
          const updateResult = await updateStatus(admin, body);
          result = updateResult;

          if (
            updateResult.previous_status !==
            updateResult.application.status
          ) {
            await queueStatusEmail(
              admin,
              updateResult.application.id,
              updateResult.previous_status,
              updateResult.application.status
            );
          }
        }

        if (action === "admin_documents") {
          result = await adminDocuments(admin, body);
        }

        if (action === "download_document") {
          result = await downloadDocument(admin, body);
        }

        if (action === "admin_confirm_payment") {
          result = await confirmPayment(admin, body, currentUser.id);
        }

        if (
          GMAIL_CLIENT_ID &&
          GMAIL_CLIENT_SECRET &&
          GMAIL_REFRESH_TOKEN &&
          GMAIL_SENDER_EMAIL
        ) {
          emailDelivery = await processEmailQueue(admin);
        }

        break;
      }

      default:
        fail(`Unknown action: ${action}`);
    }

    return jsonResponse({
      ok: true,
      version: VERSION,
      email_queue_enabled: true,
      email_sending_enabled: Boolean(
        GMAIL_CLIENT_ID &&
        GMAIL_CLIENT_SECRET &&
        GMAIL_REFRESH_TOKEN &&
        GMAIL_SENDER_EMAIL
      ),
      email_delivery: emailDelivery,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error);

    console.error("V18 API error:", message);

    const lower = message.toLowerCase();

    const isAuthError =
      lower.includes("unauthorized") ||
      lower.includes("not authenticated") ||
      lower.includes("invalid jwt") ||
      lower.includes("admin access") ||
      lower.includes("permission denied") ||
      lower.includes("please sign in") ||
      lower.includes("session is invalid");

    return jsonResponse({
      ok: false,
      version: VERSION,
      error: message,
    }, isAuthError ? 401 : 400);
  }
});

/* END OF V18 BACKEND */
