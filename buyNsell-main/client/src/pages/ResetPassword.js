import React, { useState } from "react";
import Design from "../components/Design/Design";
import styles from "./ResetPassword.module.scss";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";

function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email, otp, newPassword
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestReset = (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/request-password-reset",
      data: { email },
    })
      .then(function (response) {
        toast.success("Check your email for the reset code");
        setResetToken(response.data.resetToken);
        setStep("otp");
      })
      .catch(function (error) {
        toast.error(error?.response?.data?.message || "Email not found");
        console.log("error requesting reset", error);
      })
      .finally(() => setLoading(false));
  };

  const handleVerifyReset = (e) => {
    e.preventDefault();
    if (!otpCode || !resetToken) {
      toast.error("Enter the code sent to your email");
      return;
    }
    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/verify-reset-code",
      data: { resetToken, code: otpCode },
    })
      .then(function (response) {
        toast.success("Code verified. Enter your new password");
        setResetToken(response.data.verifiedToken);
        setStep("newPassword");
      })
      .catch(function (error) {
        toast.error(error?.response?.data?.message || "Invalid code");
        console.log("error verifying reset code", error);
      })
      .finally(() => setLoading(false));
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please enter and confirm your new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 16) {
      toast.error("Password must be between 8-16 characters");
      return;
    }
    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/reset-password",
      data: { resetToken, newPassword },
    })
      .then(function (response) {
        toast.success("Password reset successfully! Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      })
      .catch(function (error) {
        toast.error(error?.response?.data?.message || "Password reset failed");
        console.log("error resetting password", error);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div id="resetPassword" className={styles.resetPasswordPage}>
      <Design />
      <div id={styles.resetPasswordContainer}>
        <button id={styles.backButton} onClick={() => navigate(-1)}>← Back</button>
        <p>Reset Password</p>

        {step === "email" ? (
          <form id={styles.resetPasswordForm} onSubmit={handleRequestReset}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={true}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Sending code..." : "Send Reset Code"}
            </button>
          </form>
        ) : step === "otp" ? (
          <form id={styles.resetPasswordForm} onSubmit={handleVerifyReset}>
            <p className={styles.resetNote}>Enter the 6-digit code sent to your email.</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              required={true}
            />
            <div className={styles.resetActions}>
              <button type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtpCode("");
                  setResetToken("");
                }}
              >
                Back
              </button>
            </div>
          </form>
        ) : (
          <form id={styles.resetPasswordForm} onSubmit={handleResetPassword}>
            <p className={styles.resetNote}>Enter your new password.</p>
            <input
              type="password"
              placeholder="New password"
              minLength={8}
              maxLength={16}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required={true}
            />
            <input
              type="password"
              placeholder="Confirm password"
              minLength={8}
              maxLength={16}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required={true}
            />
            <div className={styles.resetActions}>
              <button type="submit" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setEmail("");
                  setOtpCode("");
                  setResetToken("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
