import React, { useState } from "react";
import Design from "../components/Design/Design";
import styles from "./Login.module.scss";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    mail: "",
    password: "",
  });
  const [step, setStep] = useState("password");
  const [pendingToken, setPendingToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => {
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) {
      return;
    }
    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/login",
      timeout: 20000,
      data: {
        ...data,
        mail: data.mail.trim().toLowerCase(),
      },
    })
      .then(function (response) {
        if (response.data.requires2fa && response.data.pendingToken) {
          toast.success("Check your email for the 2FA code");
          setPendingToken(response.data.pendingToken);
          setStep("otp");
        } else if (response.data.refreshToken) {
          toast.success("Signed in successfully!");
          localStorage.setItem("token", JSON.stringify(response.data.refreshToken));
          navigate("/");
        } else {
          toast.error("Unexpected response. Please try again.");
        }
      })
      .catch(function (error) {
        toast.error(error?.response?.data?.message || "Sign in failed!");
        console.log("error caught in frontend from backend", error);
      })
      .finally(() => setLoading(false));
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (loading) {
      return;
    }
    if (!otpCode || !pendingToken) {
      toast.error("Enter the code sent to your email");
      return;
    }
    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/verify-otp",
      timeout: 20000,
      data: { pendingToken, code: otpCode },
    })
      .then(function (response) {
        toast.success("2FA verified. Signed in!");
        localStorage.setItem("token", JSON.stringify(response.data.refreshToken));
        navigate("/");
      })
      .catch(function (error) {
        toast.error(error?.response?.data?.message || "Invalid code");
        console.log("error verifying otp", error);
      })
      .finally(() => setLoading(false));
  };

  const handleResendOtp = (e) => {
    e.preventDefault();
    if (loading) {
      return;
    }
    if (!pendingToken) {
      toast.error("Start login first");
      return;
    }
    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/resend-otp",
      timeout: 20000,
      data: { pendingToken },
    })
      .then(function (response) {
        toast.success("New code sent");
        if (response.data.pendingToken) {
          setPendingToken(response.data.pendingToken);
        }
      })
      .catch(function (error) {
        toast.error(error?.response?.data?.message || "Could not resend code");
        console.log("error resending otp", error);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div id="login" className={styles.login}>
      <Design />
      <div id={styles.loginFormContainer}>
        <button id={styles.backButton} onClick={() => navigate(-1)}>← Back</button>
        <p>Sign In</p>
        {step === "password" ? (
          <form id={styles.loginForm} onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="email"
              name="mail"
              value={data.mail}
              autoComplete="off"
              onChange={handleChange}
              required={true}
            />
            <input
              type="password"
              placeholder="password"
              minLength={8}
              maxLength={16}
              value={data.password}
              name="password"
              onChange={handleChange}
              required={true}
            />
            <span id={styles.registerHere}>
              not a user?{" "}
              <Link to="/register" style={{ color: "#ffd700" }}>
                Sign Up
              </Link>
            </span>
            <span id={styles.forgotPassword}>
              <Link to="/reset-password" style={{ color: "#ffd700" }}>
                Forgot Password?
              </Link>
            </span>
            <button type="submit" disabled={loading}>
              {loading ? "Sending code..." : "Login"}
            </button>
          </form>
        ) : (
          <form id={styles.loginForm} onSubmit={handleVerifyOtp}>
            <p className={styles.otpNote}>Enter the 6-digit code sent to your email.</p>
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
            <div className={styles.otpActions}>
              <button type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify code"}
              </button>
              <button type="button" onClick={handleResendOtp} disabled={loading}>
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("password");
                  setOtpCode("");
                  setPendingToken("");
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

export default Login;
