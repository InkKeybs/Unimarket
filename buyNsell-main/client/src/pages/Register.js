import React, { useState } from "react";
import styles from "./Login.module.scss";
import { Link, useNavigate } from "react-router-dom";
import Design from "../components/Design/Design";
import { toast } from "react-hot-toast";
import axios from "axios";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState("form");
  const [pendingToken, setPendingToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    name: "",
    mail: "",
    year: "",
    address: "",
    phone: "",
    password: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;

    if (data.name === "") { toast.error("Name field required!"); return; }
    if (!data.mail.endsWith("@rtu.edu.ph")) { toast.error("Please use your RTU email (must end with @rtu.edu.ph)!"); return; }
    if (data.year === "") { toast.error("Please enter which year you're from!"); return; }
    if (data.address === "") { toast.error("Address field required!"); return; }
    if (Number(data.phone) < 9000000000 || Number(data.phone) > 9999999999) { toast.error("Please enter valid phone no.!"); return; }
    if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}$/.test(data.password)) {
      toast.error("Password must be 8-16 characters with at least 1 uppercase, 1 lowercase, and 1 number!");
      return;
    }

    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/register",
      timeout: 20000,
      data: data,
    })
      .then((response) => {
        if (response.data.info === "userExist") {
          toast.error("User already exists with this email!");
        } else if (response.data.info === "otpSent") {
          toast.success("Verification code sent to your email!");
          setPendingToken(response.data.pendingToken);
          setStep("otp");
        }
      })
      .catch((error) => {
        toast.error(error?.response?.data?.message || "Registration failed!");
      })
      .finally(() => setLoading(false));
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!otpCode) { toast.error("Please enter the code sent to your email"); return; }

    setLoading(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/verify-register-otp",
      timeout: 20000,
      data: { pendingToken, code: otpCode },
    })
      .then((response) => {
        if (response.data.info === "registered") {
          toast.success("Registration complete!");
          setStep("done");
        }
      })
      .catch((error) => {
        toast.error(error?.response?.data?.message || "Invalid code!");
      })
      .finally(() => setLoading(false));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div id="login" className={styles.login}>
      <Design />
      <div id={styles.loginFormContainer}>
        <button id={styles.backButton} onClick={() => navigate(-1)}>← Back</button>

        {step === "done" ? (
          <div id={styles.emailSent}>
            <div id={styles.verifymail}>Registration Successful!</div>
            <div>Your account has been verified. You can now log in.</div>
            <button onClick={() => navigate("/login")} style={{ marginTop: "20px", padding: "10px 20px", backgroundColor: "#ffd700", border: "none", borderRadius: "5px", cursor: "pointer" }}>
              Go to Login
            </button>
          </div>
        ) : step === "otp" ? (
          <>
            <p>Verify Email</p>
            <div style={{ marginBottom: "16px", color: "#ccc", fontSize: "14px" }}>
              Enter the 6-digit code sent to <strong>{data.mail}</strong>
            </div>
            <form id={styles.loginForm} onSubmit={handleVerifyOtp}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Complete Registration"}
              </button>
              <button type="button" disabled={loading} onClick={() => { setStep("form"); setOtpCode(""); }} style={{ marginTop: "8px", background: "transparent", border: "1px solid #ffd700", color: "#ffd700", padding: "8px", borderRadius: "5px", cursor: "pointer" }}>
                ← Back to form
              </button>
            </form>
          </>
        ) : (
          <>
            <p>Sign Up</p>
            <form id={styles.loginForm} onSubmit={handleSubmit}>
              <input required type="text" name="name" value={data.name} placeholder="name" onChange={handleChange} autoComplete="off" />
              <input required type="email" name="mail" value={data.mail} placeholder="email (@rtu.edu.ph)" onChange={handleChange} autoComplete="off" />
              <input required type="number" name="year" value={data.year} placeholder="year" onChange={handleChange} autoComplete="off" />
              <input required type="text" name="address" value={data.address} placeholder="address" onChange={handleChange} autoComplete="off" />
              <input required type="number" name="phone" maxLength={10} minLength={10} placeholder="phone no." value={data.phone} onChange={handleChange} autoComplete="off" />
              <input required type="password" name="password" placeholder="password" minLength={8} maxLength={16} value={data.password} onChange={handleChange} autoComplete="off" />
              <span id={styles.registerHere}>
                already a user?{" "}
                <Link to="/login" style={{ color: "#ffd700" }}>Sign In</Link>
              </span>
              <button type="submit" disabled={loading}>
                {loading ? "Sending code..." : "Register"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Register;
