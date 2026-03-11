import styles from "./Card.module.scss";
import { useNavigate } from "react-router-dom";

function Card({ ele }) {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate(`/product/${ele._id}`);
  };
  return (
    <div
      onClick={() => {
        handleClick();
      }}
      className={styles.card}
    >
      <div className={styles.prodimage}>
        <img src={ele.pimage} alt="product"></img>
      </div>
      <div className={styles.proddetails}>
        <div className={styles.prodname}>
          <p className={styles.pname}>{ele.pname}</p>
          <p className={styles.pprice}>₱{ele.pprice}</p>
        </div>

        <p className={styles.pbought}>bought on : {ele.pdate.slice(0, 10)}</p>
      </div>
    </div>
  );
}

export default Card;
