import { Link } from "react-router";
import { useEffect, useState } from "react";
import { usePuterStore } from "~/lib/puter";

const Navbar = () => {
  const { getFileCount, fs, kv } = usePuterStore();
  const [fileCount, setFileCount] = useState<number>(0);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    const fetchFileCount = async () => {
      const count = await getFileCount();
      setFileCount(count);
    };
    fetchFileCount();
  }, [getFileCount]);

  const handleWipe = async () => {
    setWiping(true);
    const files = await fs.readDir("./");
    if (files && files.length > 0) {
      for (const file of files) {
        await fs.delete(file.path);
      }
    }
    await kv.flush();
    setFileCount(0);
    setWiping(false);
    alert("All data wiped!");
    window.location.reload();
  };

  return (
    <nav className="navbar">
      <Link to="/">
        <p className="text-2xl font-bold text-gradient">RESUMIND</p>
      </Link>
      <div>
        <Link to="/upload" className="primary-button w-fit">
          Upload Resume
        </Link>
        {fileCount > 0 && (
          <button
            className="primary-button w-fit ml-3"
            onClick={handleWipe}
            disabled={wiping}
          >
            {wiping ? "Wiping..." : "Wipe Data"}
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
