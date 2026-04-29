import React from "react";
import styles from "./Login.module.scss";
import { Link } from "react-router-dom";

function Terms() {
  return (
    <div className={styles.login} style={{ padding: "40px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", color: "#ddd" }}>
        <h1>Terms & Conditions — Unimarket</h1>
        <p>
          These Terms & Conditions ("Agreement") govern your access to and use of the
          Unimarket website, applications, and services (collectively, the "Service")
          operated by [Company Name] ("we", "us", "Unimarket"). By accessing or
          using the Service you agree to be bound by this Agreement. If you do not
          agree, do not use the Service.
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          This Agreement is effective when you access or use the Service. We may
          modify these terms; continued use after notice means you accept changes.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be 18+ or have parental/guardian consent to use the Service and
          represent you have authority to enter this Agreement.
        </p>

        <h2>3. Accounts &amp; Security</h2>
        <p>
          You must provide accurate information, safeguard your credentials, and are
          responsible for activity under your account. We may suspend or terminate
          accounts for violations.
        </p>

        <h2>4. Listings, Transactions &amp; User Responsibilities</h2>
        <p>
          Sellers must describe items truthfully and comply with laws. Buyers must
          pay agreed amounts. We act only as a platform and are not a party to
          sales contracts between buyers and sellers.
        </p>

        <h2>5. Shipping, Returns &amp; Refunds</h2>
        <p>
          Sellers are responsible for shipping unless otherwise stated. Return
          policies are set by sellers unless Unimarket provides a specific policy.
        </p>

        <h2>6. Prohibited Items &amp; Conduct</h2>
        <p>
          Illegal goods, stolen items, counterfeit goods, regulated items requiring
          licensing, and other items listed in our prohibited items policy are not allowed.
        </p>

        <h2>7. User Content &amp; License</h2>
        <p>
          You retain ownership of content you post. By posting you grant Unimarket a
          worldwide, royalty-free license to use, display, and distribute that content
          to operate and promote the Service.
        </p>

        <h2>8. Intellectual Property</h2>
        <p>
          All Unimarket trademarks, logos, and Site design belong to us. Do not use
          them without permission.
        </p>

        <h2>9. Privacy</h2>
        <p>Use of personal data is governed by our Privacy Policy.</p>

        <h2>10. Disclaimers &amp; Warranty</h2>
        <p>
          The Service is provided "AS IS" without warranties. We do not guarantee item
          authenticity, condition, or seller reliability.
        </p>

        <h2>11. Indemnification</h2>
        <p>
          You agree to indemnify and hold Unimarket harmless from claims arising from
          your use of the Service or violation of this Agreement.
        </p>

        <h2>12. Termination</h2>
        <p>
          You may close your account at any time. We may suspend or terminate accounts
          for breaches or legal reasons. Surviving terms (IP, indemnity) remain in effect.
        </p>

        <h2>13. Governing Law &amp; Dispute Resolution</h2>
        <p>
          This Agreement is governed by the laws of [State/Country]. Disputes will be
          resolved via [informal dispute process / arbitration] as described here.
        </p>

        <h2>14. Notices</h2>
        <p>Notices will be sent to the email on your account or via posted updates.</p>

        <h2>15. Severability</h2>
        <p>If any provision is invalid, the remainder of this Agreement remains in effect.</p>

        <h2>16. Entire Agreement</h2>
        <p>
          This Agreement, Privacy Policy, and any applicable policies are the entire
          agreement between you and Unimarket.
        </p>

        <p style={{ marginTop: 20 }}>
          Back to <Link to="/register" style={{ color: "#ffd700" }}>Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Terms;
