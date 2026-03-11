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
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => {
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
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
        if (response.data.refreshToken) {
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

  return (
    <div id="login" className={styles.login}>
      <Design />
      <div id={styles.loginFormContainer}>
        <button id={styles.backButton} onClick={() => navigate(-1)}>Back</button>
        <p>Sign In</p>
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
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
