import React from "react";
import styles from "./Design.module.scss";

function Design() {
  return (
    <div className={styles.design}>
      <div id={styles.loginLogo}>
        <div id={styles.loginUnimarket}>
          <div>
            Unimarket
          </div>
        </div>
        <div id={styles.loginMotto}>
          <div>connect, buy and sell</div>
        </div>
      </div>
      <div id={styles.illustrationScene}>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <div className={styles.circle}></div>
        <svg className={styles.iconBook} viewBox="0 0 24 24" fill="white">
          <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 4h2v5l-1-.75L9 9V4z"/>
        </svg>
        <svg className={styles.iconBox} viewBox="0 0 24 24" fill="white">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
          <line x1="9" y1="3" x2="9" y2="21" stroke="white" strokeWidth="0.5" strokeDasharray="2,2"/>
          <rect x="11" y="8" width="7" height="1.5"/>
          <rect x="11" y="11" width="7" height="1.5"/>
          <rect x="11" y="14" width="7" height="1.5"/>
        </svg>
        <svg className={styles.iconHandshake} viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
    </div>
  );
}

export default Design;
