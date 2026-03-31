import styles from "./Sell.module.scss";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";

const MAX_IMAGE_SIZE_BYTES = 14 * 1024 * 1024;

function Sell() {
  const navigate = useNavigate();
  const [cat, setCat] = useState("Gadgets");
  const [id, setId] = useState("");
  const [gadgets, setGadgets] = useState(true);
  const [books, setBooks] = useState(false);
  const [clothes, setClothes] = useState(false);
  const [supplies, setSupplies] = useState(false);
  const [food, setFood] = useState(false);
  const [others, setOthers] = useState(false);
  const [image, setImage] = useState("");
  const [data, setData] = useState({
    pname: "",
    pdate: "",
    pprice: "",
    pdetail: "",
    pcat: "",
    pimage: "",
    id: "",
  });
  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("token"));
    if (token === "") {
      navigate("/");
    }
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api",
      data: { token: token },
    })
      .then(function (response) {
        const id = response.data.userid;
        setId(id);
        setData((prev) => {
          return { ...prev, id: id };
        });
        axios({
          method: "post",
          baseURL: `${process.env.REACT_APP_BASEURL}`,
          url: "/api/profile",
          data: { id: id },
        }).catch((err) => console.log(err));
      })
      .catch(function (error) {
        console.log(error);
      });
  }, []);
  useEffect(() => {
    setData((prev) => {
      return { ...prev, pcat: cat, pimage: image };
    });
  }, [cat, image]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => {
      return { ...prev, [name]: value };
    });
  };

  const convertToBase64 = (e) => {
    const selectedFile = e.target.files && e.target.files[0];
    if (!selectedFile) {
      return;
    }

    if (selectedFile.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("Image size must be 14MB or less.");
      e.target.value = "";
      setImage("");
      return;
    }

    var reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = () => {
      setImage(reader.result);
    };
    reader.onerror = (error) => {
      console.log(error);
    };
  };
  const handleSubmit = () => {
    if (!image || image === "") {
      toast.error("Please upload a product image!");
      return;
    }
    if (!data.pname || data.pname.trim() === "") {
      toast.error("Please enter a product name!");
      return;
    }
    if (!data.pprice || data.pprice <= 0) {
      toast.error("Please enter a valid price!");
      return;
    }
    if (!data.pdate || data.pdate === "") {
      toast.error("Please select the date you bought the product!");
      return;
    }
    toast.loading("Processing", { duration: 2000 });
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/sell",
      data: { pdata: data, id: id },
    })
      .then(function (response) {
        toast.success("Product submitted for admin approval!");
        navigate("/");
      })
      .catch(function (error) {
        toast.error("Failed to submit the product!");
        console.log("error caught in frontend from backend");
      });
  };
  return (
    <div id={styles.sellPage}>
      <div id={styles.sellBox}>
        <button id={styles.backButton} onClick={() => navigate(-1)}>←</button>
        <p className={styles.sellTitle}>Sell</p>
        <div className={styles.sellinput}>
          <span>Product name : </span>
          <input
            name="pname"
            type="text"
            placeholder="Product name"
            value={data.pname}
            onChange={handleChange}
          />
        </div>

        <div className={styles.sellinput}>
          <span>Product price : </span>

          <input
            name="pprice"
            type="number"
            placeholder="₱ XYZ"
            value={data.pprice}
            onChange={handleChange}
          ></input>
        </div>
        <div className={styles.sellinput}>
          <span>Product info : </span>
          <input
            name="pdetail"
            type="text"
            placeholder="Product Description"
            onChange={handleChange}
          ></input>
        </div>
        <div className={styles.sellinput}>
          <span>Date bought : </span>
          <input
            name="pdate"
            type="date"
            placeholder="Date purchased"
            value={data.pdate}
            onChange={handleChange}
          ></input>
        </div>
        <div className={styles.checkboxes}>
          <label htmlFor="gadgets" className={styles.categoryOption}>
            <input
              id="gadgets"
              type="radio"
              name="gadgets"
              onChange={(e) => {
                setGadgets(true);
                setCat("Gadgets");
                setBooks(false);
                setClothes(false);
                setSupplies(false);
                setFood(false);
                setOthers(false);
              }}
              checked={gadgets}
            />
            <span>Gadgets</span>
          </label>

          <label htmlFor="books" className={styles.categoryOption}>
            <input
              id="books"
              type="radio"
              name="books"
              onChange={(e) => {
                setBooks(true);
                setCat("Books");
                setGadgets(false);
                setClothes(false);
                setSupplies(false);
                setFood(false);
                setOthers(false);
              }}
              checked={books}
            />
            <span>Books</span>
          </label>
          <label htmlFor="clothes" className={styles.categoryOption}>
            <input
              id="clothes"
              type="radio"
              name="clothes"
              onChange={(e) => {
                setClothes(true);
                setCat("Clothes");
                setGadgets(false);
                setBooks(false);
                setSupplies(false);
                setFood(false);
                setOthers(false);
              }}
              checked={clothes}
            />
            <span>Clothes</span>
          </label>
          <label htmlFor="supplies" className={styles.categoryOption}>
            <input
              id="supplies"
              type="radio"
              name="supplies"
              onChange={(e) => {
                setSupplies(true);
                setCat("Supplies");
                setGadgets(false);
                setBooks(false);
                setClothes(false);
                setFood(false);
                setOthers(false);
              }}
              checked={supplies}
            />
            <span>Supplies</span>
          </label>
          <label htmlFor="food" className={styles.categoryOption}>
            <input
              id="food"
              type="radio"
              name="food"
              onChange={(e) => {
                setFood(true);
                setCat("Food");
                setGadgets(false);
                setBooks(false);
                setClothes(false);
                setSupplies(false);
                setOthers(false);
              }}
              checked={food}
            />
            <span>Food</span>
          </label>
          <label htmlFor="others" className={styles.categoryOption}>
            <input
              id="others"
              type="radio"
              name="others"
              onChange={(e) => {
                setOthers(true);
                setCat("Others");
                setGadgets(false);
                setBooks(false);
                setClothes(false);
                setSupplies(false);
                setFood(false);
              }}
              checked={others}
            />
            <span>Others</span>
          </label>
        </div>

        <div className={styles.sellinput}>
          <span>Product image</span>
          <div className={styles.fileInputWrapper}>
            <label htmlFor="fileInput" className={styles.fileInputLabel}>
              {image ? "Image selected ✓" : "Choose File"}
            </label>
            <input
              id="fileInput"
              type="file"
              name="pimage"
              accept="image/*"
              onChange={convertToBase64}
              className={styles.fileInput}
            ></input>
            <p className={styles.fileHelpText}>Max 14MB. JPG, PNG, WEBP supported.</p>
          </div>
        </div>

        {image === "" || image === null ? (
          ""
        ) : (
          <img src={image} alt="uploadedImage" />
        )}
        <button type="button" onClick={handleSubmit}>
          Submit
        </button>
      </div>
    </div>
  );
}

export default Sell;
