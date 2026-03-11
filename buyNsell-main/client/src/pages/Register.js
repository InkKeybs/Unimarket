import React, { useEffect, useState } from "react";
import styles from "./Login.module.scss";
import { Link, useNavigate } from "react-router-dom";
import Design from "../components/Design/Design";
import { toast } from "react-hot-toast";
import axios from "axios";
import mailsent from "../assets/mailsent.jpg";

function Register() {
  const navigate = useNavigate();
  const [emailSent, setEmailSent] = useState(false);
  const [registered, setRegistered] = useState(false);
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
    if (data.name === "") {
      toast.error("Name field required!");
      return;
    }

    if (!data.mail.endsWith("@rtu.edu.ph")) {
      toast.error("Please use your RTU email (must end with @rtu.edu.ph)!");
      return;
    }

    if (data.year === "") {
      toast.error("Please enter which year you're from!");
      return;
    }

    if (data.address === "") {
      toast.error("Address field required!");
      return;
    }

    if (data.phone === "") {
      toast.error("Phone no. field is required!");
    }

    if (Number(data.phone) < 9000000000 || Number(data.phone) > 9999999999) {
      toast.error("Please enter valid phone no.!");
      return;
    }

    if (data.password.length < 8) {
      toast.error("Password should be 8 character long!");
      return;
    } else {
      toast.loading("Processing", {
        duration: 5000,
      });
      axios({
        method: "post",
        //   baseURL: `${process.env.REACT_APP_BASEURL}`,
        baseURL: `${process.env.REACT_APP_BASEURL}`,
        url: "/api/register",
        data: data,
      })
        .then(function (response) {
          if (response.data.info === "userExist") {
            toast.error("User already exist with this mail-id!");
          }
          if (response.data.info === "mailSent") {
            toast.success("Verification mail sent!");
            setEmailSent(true);
          }
          if (response.data.info === "registered") {
            toast.success("Registration successful!");
            setRegistered(true);
          }
        })
        .catch(function (error) {
          console.log(error);
        });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => {
      return { ...prev, [name]: value };
    });
  };

  return (
    <div id="login" className={styles.login}>
      <Design />
      <div id={styles.loginFormContainer}>
        <button id={styles.backButton} onClick={() => navigate(-1)}>← Back</button>
        {emailSent ? (
          <div id={styles.emailSent}>
            <img src={mailsent} alt="mail-sent" />
            <div id={styles.verifymail}>Verify your Email</div>
            <div>
              We have sent a verification link to <span>{data.mail},</span> in
              order to activate your account
            </div>
          </div>
        ) : registered ? (
          <div id={styles.emailSent}>
            <div id={styles.verifymail}>Registration Successful!</div>
            <div>
              Your account has been created successfully. You can now log in.
            </div>
            <button onClick={() => navigate("/login")} style={{ marginTop: "20px", padding: "10px 20px", backgroundColor: "#ffd700", border: "none", borderRadius: "5px", cursor: "pointer" }}>
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <p>Sign Up</p>
            <form id={styles.loginForm} onSubmit={handleSubmit}>
              <input
                required
                type="text"
                name="name"
                value={data.name}
                placeholder="name"
                onChange={handleChange}
                autoComplete={"off"}
              />
              <input
                required
                type="email"
                name="mail"
                value={data.mail}
                placeholder="email"
                onChange={handleChange}
                autoComplete={"off"}
              />
              <input
                required
                type="number"
                name="year"
                value={data.year}
                placeholder="year"
                onChange={handleChange}
                autoComplete={"off"}
              />
              <input
                required
                type="text"
                name="address"
                value={data.address}
                placeholder="address"
                onChange={handleChange}
                autoComplete={"off"}
              />
              <input
                required={true}
                type="number"
                name="phone"
                maxLength={10}
                minLength={10}
                placeholder="phone no."
                value={data.phone}
                onChange={handleChange}
                autoComplete={"off"}
              />
              <input
                required={true}
                type="password"
                name="password"
                pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
                placeholder="password"
                minLength={8}
                maxLength={16}
                value={data.password}
                onChange={handleChange}
                autoComplete={"off"}
              />
              <span id={styles.registerHere}>
                already a user?{" "}
                <Link to="/login" style={{ color: "#ffd700" }}>
                  Sign In
                </Link>
              </span>
              <button type="submit" onClick={handleSubmit}>
                Register
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Register;
