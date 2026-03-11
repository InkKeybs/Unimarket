import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import cross from "../assets/cross.svg";
import axios from "axios";
import tick from "../assets/tick.svg";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import loadingGIF from "../assets/loading.gif";
import styles from "./EmailVerify.module.scss";

function EmailVerify() {
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const params = useParams();
  useEffect(() => {
    toast.loading("Processing", {
      duration: 3000,
    });
    const verifyEmail = async () => {
      try {
        const url = `${process.env.REACT_APP_BASEURL}/api/users/${params.id}/verify/${params.token}`;
        const { data } = await axios.get(url);
        console.log(data);
        setVerified(true);
        setLoading(false);
        toast.success("Mail Verified!");
      } catch (error) {
        console.log(error);
        setLoading(false);
        setVerified(false);
      }
    };
    verifyEmail();
  }, [params]);
  return (
    <div id={styles.verificationPage}>
      <div id={styles.verifyInfoBox}>
        {loading ? (
          <>
            <img src={loadingGIF} alt="loading" />
            <p>Loading ... </p>
          </>
        ) : (
          <>
            <img
              src={verified ? tick : cross}
              alt={verified ? "tick-mark" : "cross-mark"}
            />
            <h1>{verified ? "Account verified!" : "Invalid Link!"}</h1>
            <p>
              {verified
                ? "You can now sign in to your account"
                : "Either the link has expired or it is an invalid link!"}
            </p>
            {verified ? (
              <Link to="/login">
                <button>Sign in</button>
              </Link>
            ) : (
              ""
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default EmailVerify;
