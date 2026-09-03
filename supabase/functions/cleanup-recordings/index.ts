import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return new Response(
      JSON.stringify({
        error:
          "Missing Supabase environment variables."
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }

  const supabase =
    createClient(
      supabaseUrl,
      serviceRoleKey
    );

  const now =
    Date.now();

  const sevenDaysAgo =
    new Date(
      now -
      7 * 24 * 60 * 60 * 1000
    ).toISOString();

  const thirtyDaysAgo =
    new Date(
      now -
      30 * 24 * 60 * 60 * 1000
    ).toISOString();

  const {
    data: submissions,
    error: loadError
  } =
    await supabase
      .from(
        "recording_submissions"
      )
      .select(
        "id, storage_path, submitted_at, reviewed_at, audio_deleted_at"
      )
      .is(
        "audio_deleted_at",
        null
      )
      .not(
        "storage_path",
        "is",
        null
      );

  if (loadError) {
    console.error(
      "Could not load submissions:",
      loadError
    );

    return new Response(
      JSON.stringify({
        error:
          loadError.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }

  const eligible =
    (submissions || [])
      .filter(
        submission => {
          if (
            submission.reviewed_at
          ) {
            return (
              submission.reviewed_at <=
              sevenDaysAgo
            );
          }

          return (
            submission.submitted_at <=
            thirtyDaysAgo
          );
        }
      );

  if (
    eligible.length === 0
  ) {
    return new Response(
      JSON.stringify({
        deleted: 0
      }),
      {
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }

  const paths =
    eligible
      .map(
        submission =>
          submission.storage_path
      )
      .filter(Boolean);

  const {
    error: storageError
  } =
    await supabase
      .storage
      .from(
        "recordings"
      )
      .remove(paths);

  if (storageError) {
    console.error(
      "Could not delete recordings:",
      storageError
    );

    return new Response(
      JSON.stringify({
        error:
          storageError.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }

  const ids =
    eligible.map(
      submission =>
        submission.id
    );

  const {
    error: updateError
  } =
    await supabase
      .from(
        "recording_submissions"
      )
      .update({
        audio_deleted_at:
          new Date().toISOString()
      })
      .in(
        "id",
        ids
      );

  if (updateError) {
    console.error(
      "Files deleted, but database rows could not be updated:",
      updateError
    );

    return new Response(
      JSON.stringify({
        error:
          updateError.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }

  return new Response(
    JSON.stringify({
      deleted:
        ids.length
    }),
    {
      headers: {
        "Content-Type":
          "application/json"
      }
    }
  );
});