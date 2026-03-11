import React, { useEffect, useState } from "react";
import styles from "./FixDeal.module.scss";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function FixDeal() {
  const [data, setData] = useState({
    pimage: "",
    buyername: "",
    pname: "",
    mail: "",
    bidprice: "",
    productprice: "",
  });

  const navigate = useNavigate();

  const [percentage, setPercentage] = useState(0);
  const [ID, setID] = useState({ productid: "", sellerid: "", buyerid: "" });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const href = window.location.href.split("/");
    const len = href.length;
    const productid = href[len - 3];
    const sellerid = href[len - 2];
    const buyerid = href[len - 1];
    setID({ productid, sellerid, buyerid });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/fixdeal",
      data: { productid, sellerid, buyerid },
    })
      .then(function (response) {
        setLoading(false);
        toast.success("fetched data successfully");
        setData(response.data.fixdeal);
        const percentHigher = (
          ((response.data.fixdeal.bidprice -
            response.data.fixdeal.productprice) /
            response.data.fixdeal.bidprice) *
          100
        ).toFixed(2);

        setPercentage(percentHigher);
        console.log(response.data.fixdeal);
      })
      .catch(function (error) {
        console.log(error);
        toast.error("Internal Error");
        console.log("error caught in frontend from backend");
        navigate("/");
      });
  }, []);

  const handleClick = () => {
    toast.loading("Processing", {
      duration: 5000,
    });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/confirmdeal",
      data: {
        productid: ID.productid,
        sellerid: ID.sellerid,
        mail: data.mail,
        productname: data.pname,
        bprice: data.bidprice,
      },
    })
      .then(function (response) {
        toast.success("An Email was sent! Happy shopping!");
        navigate("/");
      })
      .catch(function (error) {
        toast.error("Internal Error");
      });
  };
  return (
    <div className={styles.fixdealPage}>
      {loading ? (
        <p>Loading</p>
      ) : (
        <>
          <div>
            <img src={data.pimage} alt="" />{" "}
          </div>
          <div className={styles.fixdealinfo}>
            <p>
              {data.buyername} ({data.mail}) wants to buy {data.pname} for
              {" ₱"}
              {data.bidprice}
            </p>
            <div className="flex flex-row" id={styles.fixbuttons}>
              <div className="flex flex-col">
                <p>Bid Price</p>
                <p>{data.bidprice}</p>
              </div>
              <div className="flex flex-col">
                <p>Actual Price</p>
                <p>{data.productprice}</p>
              </div>
              <button onClick={handleClick}>Fix Deal</button>
            </div>
            <p>The bid price is {percentage} % more than product price.</p>
          </div>
        </>
      )}
    </div>
  );
}

export default FixDeal;
