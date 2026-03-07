

export async function predictAttendance(eventDetails: any, pastEvents: any[]) {
  const token = localStorage.getItem('eventease_token');
  const response = await fetch('/api/ai/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ eventDetails, pastEvents })
  });

  if (!response.ok) {
    return { predictedCount: 0, reasoning: "AI Prediction failed." };
  }

  return response.json();
}

export async function analyzeTrends(stats: any) {
  const token = localStorage.getItem('eventease_token');
  const response = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ stats })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI Analysis failed');
  }

  return response.json();
}


