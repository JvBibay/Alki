import type { Metadata } from "next";
import LegalPage, { Contact, H, LEGAL } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Use – Kwenta", description: "The rules for using Kwenta, including plans, payments and refunds." };

export default function Page() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms are an agreement between you and {LEGAL.name} (“we”, “us”) about your use of Kwenta, a budgeting app. By creating an account or using Kwenta you agree to them. If you
        don’t agree, please don’t use it.
      </p>

      <H>1. What Kwenta is (and isn’t)</H>
      <p>
        Kwenta helps you record and understand your own money. It is a tracking tool only. It is <b>not</b> a bank, wallet, lender or investment adviser, it does not hold or move
        your money, and nothing in it is financial, tax or legal advice. Figures you see (including interest, installment and budget estimates) depend on what you enter, so please
        check them.
      </p>

      <H>2. Your account</H>
      <p>
        You must be at least 18, or have a parent or guardian’s permission. Give a real email address, keep your password and PIN safe, and tell us if you think someone else has
        access. You’re responsible for what happens under your account. Your data stays on your device; the account is used to sign in, for cloud backup and for plans.
      </p>

      <H>3. Your data and backups</H>
      <p>
        Your budget data is stored on your device. If you turn on cloud backup, it is encrypted on your device with your sync passphrase before upload, so we cannot read it.{" "}
        <b>If you forget your sync passphrase or PIN, we cannot recover your data.</b> Please also keep your own file backups. Clearing browser data or uninstalling the app can delete
        what is stored on your device.
      </p>

      <H>4. Free and paid plans</H>
      <ul>
        <li>
          <b>7-day free trial.</b> Every new account gets full access to all features for 7 days from sign-up, with no payment and no card. It happens once per account and does not renew by itself. When it
          ends, your account moves to the free plan unless you choose a paid plan. Nothing you entered is deleted.
        </li>
        <li>The free plan includes up to 2 accounts and the core tracking features. Paid plans (monthly, annual and lifetime) unlock the features listed on the Plans screen in the app.</li>
        <li>Prices are in Philippine pesos and are shown before you pay. We may change prices or what each plan includes; a change never reduces a period you have already paid for.</li>
        <li>
          <b>No automatic renewal.</b> We never charge you automatically. Monthly and annual plans last for the period you paid for and then end unless you pay again.
        </li>
        <li>
          <b>Lifetime</b> means access for as long as Kwenta is offered, not the lifetime of the buyer. If we ever close the service we will give reasonable notice and a way to export your
          data.
        </li>
        <li>If your trial or a plan ends, everything on your device keeps working (if you have more than 2 accounts you keep them, you just can't add more), and you can still restore or delete your cloud backup. Only the paid features stop.</li>
      </ul>

      <H>5. How payment works</H>
      <p>
        Payment is made by you directly (for example by GCash or QR Ph) to the account shown in the app, then you send us proof of payment together with your account email. We check it
        and turn your plan on, usually within a day. Please double-check the amount and the account name before you pay. We never ask for your password, PIN, card number or OTP. Kwenta
        itself does not collect or store card or wallet details. We keep records of payments as the law requires.
      </p>

      <H>6. Refunds</H>
      <ul>
        <li>If you were charged the wrong amount, or paid twice, we will refund the difference.</li>
        <li>You may ask for a refund within <b>7 days</b> of your first payment if you haven’t found the plan useful. After that, payments for time already used are not refundable.</li>
        <li>This does not limit any rights you have under Philippine consumer law.</li>
      </ul>
      <p>
        To ask, write to <Contact /> with your account email and proof of payment. Refunds go back the way you paid.
      </p>

      <H>7. Using Kwenta properly</H>
      <p>
        Don’t misuse Kwenta: no attacking or overloading it, no attempts to get around plan limits or other people’s access, no uploading harmful or illegal files, and no using it to
        break the law. Uploads are limited in size and type for everyone’s safety. We may limit or suspend an account that abuses the service.
      </p>

      <H>8. Feedback</H>
      <p>
        If you send feedback, you let us use it to improve Kwenta. We only show it publicly if you tick the box that allows it, and then only with your name masked.
      </p>

      <H>9. Our responsibility</H>
      <p>
        We work to keep Kwenta accurate and available, but it is provided “as is”. We can’t promise it will always be uninterrupted or error-free. To the extent the law allows, we are
        not liable for indirect losses, lost data you did not back up, or decisions you make from the numbers shown, and our total liability for any claim is limited to what you paid us
        in the 12 months before it. Nothing here removes liability that cannot legally be limited.
      </p>

      <H>10. Ending things</H>
      <p>
        You can stop using Kwenta at any time and ask us to delete your account (see the Privacy Notice). We may end or suspend access for serious or repeated breaches of these terms.
      </p>

      <H>11. Changes and law</H>
      <p>
        We may update these terms and will change the date above; for important changes we’ll tell you in the app. Continuing to use Kwenta means you accept the update. These terms are
        governed by the laws of the Philippines.
      </p>

      <H>12. Contact</H>
      <p>
        Questions about these terms: <Contact />.
      </p>
    </LegalPage>
  );
}
