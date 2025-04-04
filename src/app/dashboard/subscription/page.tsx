// ...existing code...
import { fetchUsageHistory } from '../../../lib/usage';
// ...existing code...

export default function SubscriptionPage() {
  const [usageHistory, setUsageHistory] = useState([]);

  useEffect(() => {
    async function loadUsageHistory() {
      const history = await fetchUsageHistory();
      setUsageHistory(history);
    }
    loadUsageHistory();
  }, []);

  return (
    <div>
      {/* ...existing code... */}
      <section>
        <h2>Usage History</h2>
        <ul>
          {usageHistory.map((usage) => (
            <li key={usage.id}>
              {usage.date}: {usage.amount} units
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
