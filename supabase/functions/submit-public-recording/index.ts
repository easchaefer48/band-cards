import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders
      }
    );
  }


  try {

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      );


    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Missing Supabase server credentials."
      );
    }


    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey
      );


    const formData =
      await req.formData();


    const studentName =
      String(
        formData.get("studentName") || ""
      ).trim();


    const submitterComment =
      String(
        formData.get("comment") || ""
      ).trim();


    const recording =
      formData.get("recording");


    if (!studentName) {

      return new Response(
        JSON.stringify({
          error: "Name is required."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    if (studentName.length > 100) {

      return new Response(
        JSON.stringify({
          error:
            "Name is too long."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    if (
      submitterComment.length > 500
    ) {

      return new Response(
        JSON.stringify({
          error:
            "Comment is too long."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    if (
      !(recording instanceof File)
    ) {

      return new Response(
        JSON.stringify({
          error:
            "Recording is required."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    const maxBytes =
      10 * 1024 * 1024;


    if (
      recording.size >
      maxBytes
    ) {

      return new Response(
        JSON.stringify({
          error:
            "Recording is too large."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    if (
      !recording.type
        .startsWith("audio/")
    ) {

      return new Response(
        JSON.stringify({
          error:
            "Only audio recordings are allowed."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }


    let extension =
      "webm";


    if (
      recording.type.includes("mp4")
    ) {
      extension =
        "mp4";
    }


    const now =
      new Date();


    const year =
      now
        .getUTCFullYear();


    const month =
      String(
        now.getUTCMonth() + 1
      ).padStart(
        2,
        "0"
      );


    const randomId =
      crypto.randomUUID();


    const storagePath =
      `public-sender/${year}/${month}/${randomId}.${extension}`;


    const audioBuffer =
      await recording
        .arrayBuffer();


    const {
      error: uploadError
    } =
      await supabase
        .storage
        .from("recordings")
        .upload(
          storagePath,
          audioBuffer,
          {
            contentType:
              recording.type,

            upsert:
              false
          }
        );


    if (uploadError) {
      throw uploadError;
    }


    const {
      data: submission,
      error: insertError
    } =
      await supabase
        .from(
          "recording_submissions"
        )
        .insert({
          student_id:
            "",

          student_name:
            studentName,

          class_id:
            null,

          storage_path:
            storagePath,

          submission_type:
            "public_sender",

          submitter_uid:
            null,

          submitter_comment:
            submitterComment || null,

          status:
            "Pending"
        })
        .select("id")
        .single();


    if (insertError) {

      await supabase
        .storage
        .from("recordings")
        .remove([
          storagePath
        ]);


      throw insertError;
    }


    return new Response(
      JSON.stringify({
        success: true,
        submissionId:
          submission.id
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json"
        }
      }
    );

  }
  catch (error) {

    console.error(
      "Public recording submission failed:",
      error
    );


    return new Response(
      JSON.stringify({
        error:
          "Could not submit recording."
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json"
        }
      }
    );

  }

});