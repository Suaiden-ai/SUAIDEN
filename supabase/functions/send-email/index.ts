import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html }: EmailRequest = await req.json();

    const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");

    if (!SMTP_USER || !SMTP_PASS) {
      throw new Error("SMTP credentials not configured");
    }

    const conn = await Deno.connect({ hostname: SMTP_HOST, port: SMTP_PORT });
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const sendCommand = async (command: string) => {
      await writer.write(encoder.encode(command + "\r\n"));
    };

    const readLine = async () => {
      const { value } = await reader.read();
      return decoder.decode(value);
    };

    // SMTP Flow
    console.log(await readLine()); // 220
    await sendCommand(`EHLO ${SMTP_HOST}`);
    console.log(await readLine()); // 250

    await sendCommand("STARTTLS");
    console.log(await readLine()); // 220

    // Upgrade to TLS
    const tlsConn = await Deno.startTls(conn, { hostname: SMTP_HOST });
    const tlsReader = tlsConn.readable.getReader();
    const tlsWriter = tlsConn.writable.getWriter();

    const sendTlsCommand = async (command: string) => {
      await tlsWriter.write(encoder.encode(command + "\r\n"));
    };

    const readTlsLine = async () => {
      const { value } = await tlsReader.read();
      return decoder.decode(value);
    };

    await sendTlsCommand(`EHLO ${SMTP_HOST}`);
    console.log(await readTlsLine());

    await sendTlsCommand("AUTH LOGIN");
    console.log(await readTlsLine()); // 334

    await sendTlsCommand(btoa(SMTP_USER));
    console.log(await readTlsLine()); // 334

    await sendTlsCommand(btoa(SMTP_PASS));
    console.log(await readTlsLine()); // 235

    await sendTlsCommand(`MAIL FROM:<${SMTP_USER}>`);
    console.log(await readTlsLine()); // 250

    await sendTlsCommand(`RCPT TO:<${to}>`);
    console.log(await readTlsLine()); // 250

    await sendTlsCommand("DATA");
    console.log(await readTlsLine()); // 354

    const message = [
      `From: Suaiden <${SMTP_USER}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=UTF-8",
      "MIME-Version: 1.0",
      "",
      html,
      ".",
    ].join("\r\n");

    await sendTlsCommand(message);
    console.log(await readTlsLine()); // 250

    await sendTlsCommand("QUIT");
    tlsConn.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
