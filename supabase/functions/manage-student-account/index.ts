import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json"
};

Deno.serve(async (req) => {

  // ----------------------------------------------------------
  // CORS
  // ----------------------------------------------------------

  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders
      }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed."
      }),
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  // ----------------------------------------------------------
  // ENVIRONMENT
  // ----------------------------------------------------------

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY");

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Missing Supabase environment variables."
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }

  // ----------------------------------------------------------
  // VERIFY CALLER
  // ----------------------------------------------------------

  const authorization =
    req.headers.get(
      "Authorization"
    );

  if (!authorization) {
    return new Response(
      JSON.stringify({
        error:
          "Authentication required."
      }),
      {
        status: 401,
        headers: corsHeaders
      }
    );
  }

  // This client represents the logged-in caller.
  const callerClient =
    createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization:
              authorization
          }
        }
      }
    );

  const {
    data: userData,
    error: userError
  } =
    await callerClient.auth
      .getUser();

  const caller =
    userData?.user;

  if (
    userError ||
    !caller
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Invalid authentication."
      }),
      {
        status: 401,
        headers: corsHeaders
      }
    );
  }

  // ----------------------------------------------------------
  // ADMIN CLIENT
  // ----------------------------------------------------------

  const adminClient =
    createClient(
      supabaseUrl,
      serviceRoleKey
    );

  // ----------------------------------------------------------
  // VERIFY ACTIVE TEACHER + SCHOOL
  // ----------------------------------------------------------

  const {
    data: teacher,
    error: teacherError
  } =
    await adminClient
      .from("teacher_accounts")
      .select("teacher_id")
      .eq(
        "auth_user_id",
        caller.id
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    teacherError ||
    !teacher
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Active teacher account required."
      }),
      {
        status: 403,
        headers: corsHeaders
      }
    );
  }

  const {
    data: membership,
    error: membershipError
  } =
    await adminClient
      .from(
        "school_teacher_memberships"
      )
      .select("school_id")
      .eq(
        "teacher_id",
        teacher.teacher_id
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    membershipError ||
    !membership
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Active school membership required."
      }),
      {
        status: 403,
        headers: corsHeaders
      }
    );
  }

  // ----------------------------------------------------------
  // REQUEST DATA
  // ----------------------------------------------------------

  let body;

  try {
    body = await req.json();
  }

  catch {
    return new Response(
      JSON.stringify({
        error:
          "Invalid request body."
      }),
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }

  const firstName =
    String(
      body.firstName || ""
    ).trim();

  const lastName =
    String(
      body.lastName || ""
    ).trim();

  const email =
    String(
      body.email || ""
    )
      .trim()
      .toLowerCase();

  const temporaryPassword =
    String(
      body.temporaryPassword || ""
    );

  if (
    !firstName ||
    !lastName ||
    !email ||
    !temporaryPassword
  ) {
    return new Response(
      JSON.stringify({
        error:
          "First name, last name, school email, and temporary password are required."
      }),
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }

  if (
    temporaryPassword.length < 8
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Temporary password must be at least 8 characters."
      }),
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }

  // ----------------------------------------------------------
  // CREATE STUDENT RECORD
  // ----------------------------------------------------------

  const {
    data: student,
    error: studentError
  } =
    await adminClient
      .from("students")
      .insert({
        first_name: firstName,
        last_name: lastName,
        active: true
      })
      .select("student_id")
      .single();

  if (
    studentError ||
    !student
  ) {
    console.error(
      "Student creation failed:",
      studentError
    );

    return new Response(
      JSON.stringify({
        error:
          studentError?.message ||
          "Could not create student."
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }

  const studentUuid =
    student.student_id;

  // ----------------------------------------------------------
  // CREATE SCHOOL MEMBERSHIP
  // ----------------------------------------------------------

  const {
    error: schoolMembershipError
  } =
    await adminClient
      .from(
        "school_student_memberships"
      )
      .insert({
        school_id:
          membership.school_id,

        student_id:
          studentUuid,

        status:
          "active",

        active:
          true
      });

  if (schoolMembershipError) {
    console.error(
      "School membership creation failed:",
      schoolMembershipError
    );

    // Roll back the student record.
    await adminClient
      .from("students")
      .delete()
      .eq(
        "student_id",
        studentUuid
      );

    return new Response(
      JSON.stringify({
        error:
          schoolMembershipError.message
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }

  // ----------------------------------------------------------
  // CREATE SUPABASE AUTH USER
  // ----------------------------------------------------------

  const {
    data: authData,
    error: authError
  } =
    await adminClient.auth.admin
      .createUser({
        email,
        password:
          temporaryPassword,

        email_confirm:
          true
      });

  if (
    authError ||
    !authData?.user
  ) {
    console.error(
      "Auth user creation failed:",
      authError
    );

    // Roll back school membership and student.
    await adminClient
      .from(
        "school_student_memberships"
      )
      .delete()
      .eq(
        "student_id",
        studentUuid
      );

    await adminClient
      .from("students")
      .delete()
      .eq(
        "student_id",
        studentUuid
      );

    return new Response(
      JSON.stringify({
        error:
          authError?.message ||
          "Could not create student login."
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }

  const authUser =
    authData.user;

  // ----------------------------------------------------------
  // CREATE STUDENT ACCOUNT MAPPING
  // ----------------------------------------------------------

  const {
    data: account,
    error: accountError
  } =
    await adminClient
      .from("student_accounts")
      .insert({
        auth_user_id:
          authUser.id,

        student_uuid:
          studentUuid,

        student_id:
          null,

        username:
          email,

        student_name:
          `${firstName} ${lastName}`,

        active:
          true
      })
      .select(
        "id, auth_user_id, student_uuid, username, active"
      )
      .single();

  if (
    accountError ||
    !account
  ) {
    console.error(
      "Student account mapping failed:",
      accountError
    );

    // Roll back Auth user first.
    await adminClient.auth.admin
      .deleteUser(
        authUser.id
      );

    await adminClient
      .from(
        "school_student_memberships"
      )
      .delete()
      .eq(
        "student_id",
        studentUuid
      );

    await adminClient
      .from("students")
      .delete()
      .eq(
        "student_id",
        studentUuid
      );

    return new Response(
      JSON.stringify({
        error:
          accountError?.message ||
          "Could not create student account."
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }

  // ----------------------------------------------------------
  // SUCCESS
  // ----------------------------------------------------------

  return new Response(
    JSON.stringify({
      success: true,

      student: {
        studentUuid,
        firstName,
        lastName,
        username:
          account.username
      }
    }),
    {
      status: 200,
      headers: corsHeaders
    }
  );
});