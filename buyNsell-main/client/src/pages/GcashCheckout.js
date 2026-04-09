import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { LoaderIcon, toast } from "react-hot-toast";
import styles from "./GcashCheckout.module.scss";

function GcashCheckout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { productId } = useParams();
  const [product, setProduct] = useState(location.state?.product || {});
  const [loadingProduct, setLoadingProduct] = useState(false);

  const [buyerName, setBuyerName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofDetails, setProofDetails] = useState("");
  const [message, setMessage] = useState("");
  const [qrImageFile, setQrImageFile] = useState(null);
  const [qrImagePreview, setQrImagePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amount = useMemo(() => Number(product.pprice || 0), [product.pprice]);
  const formattedAmount = useMemo(
    () => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount),
    [amount]
  );

  const merchantName = process.env.REACT_APP_GCASH_ACCOUNT_NAME || "Your GCash account";
  const merchantNumber = process.env.REACT_APP_GCASH_NUMBER || "Replace with your GCash number";

  useEffect(() => {
    if (!qrImageFile) {
      setQrImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(qrImageFile);
    setQrImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [qrImageFile]);

  useEffect(() => {
    if (product?.pprice || product?.id) {
      return;
    }

    if (!productId) {
      return;
    }

    const tokenStr = localStorage.getItem("token");
    const token = tokenStr ? JSON.parse(tokenStr) : null;

    setLoadingProduct(true);
    axios({
      method: "post",
      baseURL: `${process.env.REACT_APP_BASEURL}`,
      url: "/api/prodData",
      data: { id: productId, token },
    })
      .then((response) => {
        const details = response.data?.details || {};
        setProduct({
          id: details.data?.id || details.data?._id || productId,
          pname: details.data?.pname || "Selected item",
          pprice: details.data?.pprice || 0,
          pimage: details.data?.pimage || "",
          sellerName: details.name || "Seller",
          sellerMail: details.mail || "",
        });
      })
      .catch(() => {
        toast.error("Unable to load product details for checkout");
      })
      .finally(() => {
        setLoadingProduct(false);
      });
  }, [product, productId]);

    const handleQrUpload = (event) => {
      const file = event.target.files?.[0];

      if (!file) {
        setQrImageFile(null);
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file for the GCash QR code");
        event.target.value = "";
        return;
      }

      setQrImageFile(file);
    };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!buyerName.trim()) {
      toast.error("Enter the buyer name");
      return;
    }

    if (!referenceNumber.trim()) {
      toast.error("Enter the GCash reference number");
      return;
    }

    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      toast.success("Payment request submitted for manual verification");
      navigate("/");
    }, 900);
  };

  return (
    <div className={styles.checkoutPage}>
      <div className={styles.checkoutGlow} aria-hidden="true" />
      <div className={styles.checkoutShell}>
        <header className={styles.heroCard}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>Manual GCash Checkout</p>
            <h1>Pay by scanning your GCash QR and submit proof for review.</h1>
            <p className={styles.heroCopy}>
              This flow is designed for small-volume orders: the buyer pays manually,
              then you verify the transfer before marking the order as paid.
            </p>
            <div className={styles.heroPills}>
              <span>Pending review</span>
              <span>Manual confirmation</span>
              <span>Buyer proof required</span>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>Order total</p>
            <div className={styles.summaryAmount}>{formattedAmount}</div>
            <div className={styles.summaryMeta}>
              <span>Product ID</span>
              <strong>{productId || product.id || "N/A"}</strong>
            </div>
            <div className={styles.summaryMeta}>
              <span>Seller</span>
              <strong>{product.sellerName || "Seller"}</strong>
            </div>
          </div>
        </header>

        <main className={styles.checkoutGrid}>
          <section className={styles.qrPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Step 1</p>
                <h2>Pay using GCash</h2>
              </div>
              <span className={styles.statusBadge}>GCash</span>
            </div>

            {loadingProduct ? (
              <div className={styles.loadingWrap}>
                <LoaderIcon />
              </div>
            ) : (
              <div className={styles.uploadCard}>
                <div className={styles.uploadHeader}>
                  <div className={styles.uploadBadge}>QR</div>
                  <div>
                    <h3>Upload your GCash QR image</h3>
                    <p>Select a local PNG or JPG file to preview it here before payment.</p>
                  </div>
                </div>

                {qrImagePreview ? (
                  <div className={styles.qrPreviewFrame}>
                    <img src={qrImagePreview} alt="Uploaded GCash QR code preview" className={styles.qrPreviewImage} />
                  </div>
                ) : (
                  <label className={styles.uploadDropzone}>
                    <input type="file" accept="image/*" onChange={handleQrUpload} />
                    <span className={styles.uploadIcon} aria-hidden="true">+</span>
                    <strong>Choose QR image</strong>
                    <p>PNG, JPG, or WEBP image only.</p>
                  </label>
                )}

                {qrImagePreview ? (
                  <div className={styles.uploadActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setQrImageFile(null)}
                    >
                      Replace image
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <div className={styles.merchantBox}>
              <div>
                <span>GCash account name</span>
                <strong>{merchantName}</strong>
              </div>
              <div>
                <span>GCash number</span>
                <strong>{merchantNumber}</strong>
              </div>
            </div>

            <ul className={styles.stepList}>
              <li>Pay the exact amount shown.</li>
              <li>Save the transaction reference number.</li>
              <li>Submit proof so the order can be verified.</li>
            </ul>
          </section>

          <section className={styles.formPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Step 2</p>
                <h2>Submit payment details</h2>
              </div>
            </div>

            <form className={styles.checkoutForm} onSubmit={handleSubmit}>
              <label className={styles.fieldGroup}>
                <span>Buyer name</span>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(event) => setBuyerName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </label>

              <label className={styles.fieldGroup}>
                <span>Reference number</span>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  placeholder="GCash transaction reference"
                />
              </label>

              <label className={styles.fieldGroup}>
                <span>Proof details</span>
                <textarea
                  rows="4"
                  value={proofDetails}
                  onChange={(event) => setProofDetails(event.target.value)}
                  placeholder="Paste screenshot filename, note, or any extra confirmation details"
                />
              </label>

              <label className={styles.fieldGroup}>
                <span>Optional note</span>
                <textarea
                  rows="3"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Add delivery instructions, pickup time, or a short message"
                />
              </label>

              <div className={styles.noticeBox}>
                Orders stay in pending status until you verify the payment manually.
              </div>

              <button type="submit" className={styles.submitButton} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit for verification"}
              </button>

              <Link to="/" className={styles.backLink}>
                Cancel and go back home
              </Link>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

export default GcashCheckout;