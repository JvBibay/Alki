import type { Metadata } from "next";
import LegalPage, { Contact, H, LEGAL } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Notice – Kwenta", description: "What Kwenta keeps, where, why, and your rights under the Data Privacy Act." };

export default function Page() {
  return (
    <LegalPage title="Privacy Notice">
      <p>
        {LEGAL.name} (“we”) runs Kwenta. This notice explains what personal information we handle, why, and your rights under the Philippine Data Privacy Act of 2012 (Republic Act 10173).
        We aim to collect as little as possible.
      </p>

      <H>1. What stays on your device</H>
      <p>
        Your accounts, transactions, budgets, debts, receipt photos and settings are stored on your own device. We don’t receive them. There are no ads and no tracking or analytics
        scripts in the app.
      </p>

      <H>2. What we do receive, and why</H>
      <ul>
        <li>
          <b>Account:</b> your email address and a password (stored by our sign-in provider as a hash, never in plain text). Purpose: to let you sign in and use cloud features.
        </li>
        <li>
          <b>Cloud backup (optional):</b> your data, <b>encrypted on your device</b> with your sync passphrase before it is uploaded. We can’t read it, and we never receive the
          passphrase.
        </li>
        <li>
          <b>Plan and payment records:</b> which plan you have and until when, plus the proof of payment you send us (for example a GCash screenshot, which can show your name and mobile
          number). Purpose: to activate your plan, handle refunds, and keep the financial records the law requires.
        </li>
        <li>
          <b>Feedback (optional):</b> your message, the screen you sent it from, and an optional screenshot. Your email is shown to us only if you tick “OK to contact me”. Praise is
          shown publicly only if you allow it, with your name masked.
        </li>
        <li>
          <b>Push reminders (optional):</b> a device address from your browser’s push service and the times to wake it. The reminders’ contents are never sent to us.
        </li>
        <li>
          <b>Technical data:</b> like any website, our host sees your IP address and basic request details in short-lived logs, used for security and to prevent abuse.
        </li>
      </ul>
      <p>
        Voice input, if you use it, is handled by your browser’s speech service (in Chrome, Google), not by us. Exchange rates, if you update them, are fetched from a public rates site
        without sending any of your data.
      </p>

      <H>3. Who handles it for us</H>
      <p>
        We use <b>Supabase</b> (sign-in, database and file storage) and <b>Vercel</b> (hosting). They process data on our behalf and may store it on servers outside the Philippines. We
        don’t sell your information or use it for advertising, and we share it only with these providers, or when the law requires.
      </p>

      <H>4. How long we keep it</H>
      <ul>
        <li>Account and cloud backup: until you delete the backup or ask us to delete your account.</li>
        <li>Plan and payment records: as long as needed for refunds, disputes and legal record-keeping.</li>
        <li>Feedback: until we no longer need it to improve Kwenta, or you ask us to remove it.</li>
      </ul>

      <H>5. How we protect it</H>
      <p>
        Backups are end-to-end encrypted; your PIN protects local data with strong encryption; database rules stop one account from reading another’s data; uploads are checked for type and
        size; and the app uses security headers. No system is perfectly secure. If a breach affecting your personal data happens, we will tell you and the National Privacy Commission as
        the law requires.
      </p>

      <H>6. Your rights</H>
      <p>
        You can ask to be informed about, access, correct, delete or block your personal information, to receive a copy, to object to its processing, and to claim compensation for
        damage from unlawful use. You can withdraw consent at any time (for example by deleting your cloud backup in Settings → Cloud backup, or turning off reminders). To use any right, or to
        delete your account, write to <Contact />. If you are unhappy with how we handled your request you may complain to the National Privacy Commission (privacy.gov.ph).
      </p>

      <H>7. Children</H>
      <p>Kwenta is for people 18 and over. We don’t knowingly collect information from children. If you think a child has given us any, tell us and we’ll delete it.</p>

      <H>8. Changes</H>
      <p>If we change this notice, we’ll update the date above and, for important changes, tell you in the app.</p>

      <H>9. Contact</H>
      <p>
        Privacy questions and requests: <Contact />.
      </p>
    </LegalPage>
  );
}
