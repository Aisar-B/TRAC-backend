import { supabase } from '../config/supabase.js';

// ===========================================
// VALID STATUS TRANSITIONS
// ===========================================
const validTransitions = {
  'pending': ['approved', 'rejected'],
  'approved': ['rejected'],
  'or_submitted': ['or_confirmed', 'or_rejected', 'rejected'],
  'or_rejected': ['or_submitted', 'rejected'],
  'or_confirmed': ['processing', 'rejected'],
  'processing': ['ready', 'rejected'],
  'ready': ['claimed', 'rejected'],
  'claimed': [],
  'rejected': []
};

// ===========================================
// STATUS DISPLAY NAMES
// ===========================================
const statusLabels = {
  'pending': 'Pending',
  'approved': 'Approved',
  'or_submitted': 'OR Submitted',
  'or_rejected': 'OR Rejected',
  'or_confirmed': 'OR Confirmed',
  'processing': 'Processing',
  'ready': 'Ready for Pickup',
  'claimed': 'Claimed',
  'rejected': 'Rejected'
};

// ===========================================
// HELPER: Get Philippine Date (YYYY-MM-DD)
// ===========================================
const getPHDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ===========================================
// 🆕 FIFO HELPER: Get all active requests across dates
// ===========================================
const getAllActiveRequests = async () => {
  const { data, error } = await supabase
    .from('requests')
    .select('id, queue_number, queue_date, status')
    .in('status', ['pending', 'approved', 'or_submitted', 'or_rejected', 'or_confirmed', 'processing'])
    .order('queue_date', { ascending: true })
    .order('queue_number', { ascending: true });
  
  if (error) {
    console.error('Error fetching active requests:', error);
    return [];
  }
  
  return data || [];
};

const getFirstPendingRequest = async () => {
  const { data, error } = await supabase
    .from('requests')
    .select('id, queue_number, queue_date')
    .eq('status', 'pending')
    .order('queue_date', { ascending: true })
    .order('queue_number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

// ===========================================
// 🆕 FIFO HELPER: Check if request is next in line (with carry-over)
// ===========================================
const isNextInLine = async (requestId, currentRequest) => {
  try {
    const queueNumber = currentRequest.queue_number;
    const queueDate = currentRequest.queue_date;
    
    if (!queueNumber) {
      console.log('⚠️ No queue_number found, skipping FIFO check');
      return true;
    }
    
    // Get all active requests (pending, approved, processing)
    const activeRequests = await getAllActiveRequests();
    
    if (activeRequests.length === 0) {
      return true;
    }
    
    // The first in line is the one with the earliest date and smallest queue number
    const firstInLine = activeRequests[0];
    
    // Check if current request is the first in line
    const isFirst = queueDate === firstInLine.queue_date && queueNumber === firstInLine.queue_number;
    
    if (!isFirst) {
      console.log(`❌ FIFO Violation: Queue #${queueNumber} (${queueDate}) tried to process, but Queue #${firstInLine.queue_number} (${firstInLine.queue_date}) is next`);
    }
    
    return isFirst;
    
  } catch (err) {
    console.error('FIFO check error:', err);
    return true;
  }
};

export const isRequestNextInLine = isNextInLine;

// ===========================================
// 🆕 FIFO HELPER: Get next queue number message (with carry-over)
// ===========================================
const getNextQueueMessage = async (currentRequest) => {
  try {
    const activeRequests = await getAllActiveRequests();
    
    if (activeRequests.length === 0) {
      return null;
    }
    
    const firstInLine = activeRequests[0];
    return firstInLine.queue_number;
    
  } catch (err) {
    return null;
  }
};

// ===========================================
// HELPER: Save Admin Activity Log
// ===========================================
const saveAdminActivityLog = async (adminId, request, newStatus, reason = null, req) => {
  try {
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .insert([{
        admin_id: adminId,
        request_id: request.id,
        action: newStatus,
        previous_status: request.status,
        new_status: newStatus,
        reason: newStatus === 'rejected' ? reason : null,
        details: {
          tracking_code: request.tracking_code,
          request_type: request.request_type,
          student_name: request.sender_name,
          student_id: request.sender_id_number,
          copies: request.copies,
          queue_number: request.queue_number,
          queue_date: request.queue_date
        },
        ip_address: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'] || null
      }]);

    if (error) {
      console.error('❌ Failed to save admin activity log:', error);
    } else {
      console.log('✅ Admin activity logged:', { adminId, requestId: request.id, action: newStatus });
    }
  } catch (err) {
    console.error('❌ Error saving admin activity log:', err);
  }
};

// ===========================================
// UPDATE SINGLE REQUEST STATUS (WITH FIFO VALIDATION)
// ===========================================
export const updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.userId;

    console.log('🔍 Looking for request with identifier:', id);

    // Validation
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = ['pending', 'approved', 'or_submitted', 'or_rejected', 'or_confirmed', 'processing', 'ready', 'claimed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    if (status === 'rejected' && !reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    // Try to find request by tracking_code first, then by UUID
    let request = null;
    
    // Try exact match with tracking_code
    const { data: trackingMatch, error: trackingError } = await supabase
      .from('requests')
      .select('*')
      .eq('tracking_code', id)
      .maybeSingle();
    
    if (trackingMatch) {
      request = trackingMatch;
      console.log('✅ Found by tracking_code');
    }
    
    // If not found, try by UUID
    if (!request) {
      const { data: uuidMatch, error: uuidError } = await supabase
        .from('requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (uuidMatch) {
        request = uuidMatch;
        console.log('✅ Found by UUID');
      }
    }

    if (!request) {
      console.log('❌ Request not found');
      return res.status(404).json({ message: 'Request not found' });
    }

    console.log('✅ Request found:', request.id, 'with tracking_code:', request.tracking_code);
    console.log(`📊 Queue #${request.queue_number} | Date: ${request.queue_date} | Status: ${request.status}`);

    // Only the earliest pending request can be approved; later requests
    // become eligible as soon as earlier requests leave the pending state.
    const allowedTransitions = validTransitions[request.status] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({ 
        message: `Cannot change from ${request.status} to ${status}`,
        currentStatus: request.status,
        allowedTransitions: allowedTransitions
      });
    }

    if (status === 'approved') {
      const firstPendingRequest = await getFirstPendingRequest();
      if (firstPendingRequest?.id !== request.id) {
        return res.status(409).json({
          success: false,
          message: `Approval order required. Approve Queue #${firstPendingRequest?.queue_number || 'the earlier request'} first.`,
          approvalOrderViolation: true,
          currentQueue: request.queue_number,
          blockingQueue: firstPendingRequest?.queue_number || null
        });
      }
    }

// ===========================================
// 🆕 FIFO VALIDATION (with carry-over support)
// Enforce FIFO for status changes to 'approved', 'processing', 'ready', 'claimed'
// ===========================================
const statusesRequiringFIFO = ['or_confirmed', 'processing', 'ready'];

if (statusesRequiringFIFO.includes(status)) {
  const isNext = await isNextInLine(id, request);
  
  if (!isNext) {
    const nextQueue = await getNextQueueMessage(request);
    return res.status(400).json({
      success: false,
      message: `⚠️ FIFO Order Required: Cannot process Queue #${request.queue_number} (${request.queue_date}) yet.`,
      error: `Please complete Queue #${nextQueue} first.`,
      currentQueue: request.queue_number,
      nextQueue: nextQueue,
      fifoViolation: true
    });
  }
}

    // Prepare updates
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };

    // Add timestamp based on status
    const timestampFields = {
      'approved': 'approved_date',
      'processing': 'processed_date',
      'ready': 'ready_date',
      'claimed': 'claimed_date',
      'rejected': 'rejected_date'
    };

    if (timestampFields[status]) {
      updates[timestampFields[status]] = new Date().toISOString();
    }

    if (status === 'rejected') {
      updates.rejected_reason = reason;
    }

    // Add to status history
    const historyEntry = {
      status,
      timestamp: new Date().toISOString(),
      admin_id: adminId,
      previous_status: request.status,
      reason: reason || null
    };

    const currentHistory = request.status_history || [];
    updates.status_history = [...currentHistory, historyEntry];

    // Update database
    const { data: updatedRequest, error: updateError } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', request.id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`✅ Status updated to ${status} for Queue #${request.queue_number} (${request.queue_date})`);

    // SAVE TO ADMIN ACTIVITY LOGS
    await saveAdminActivityLog(adminId, request, status, reason, req);

    // =============================================
    // 📧 SEND EMAIL NOTIFICATION (FOR APPROVED, READY, REJECTED)
    // =============================================
    if (status === 'approved' || status === 'ready' || status === 'rejected') {
      import('../services/emailService.js').then(({ sendStatusEmail }) => {
        sendStatusEmail(request, status, reason).catch(emailErr => {
          console.error('📧 Background email error:', emailErr);
        });
      });
    }

    res.status(200).json({
      success: true,
      message: `Request ${statusLabels[status]} successfully`,
      request: {
        id: updatedRequest.tracking_code,
        actualId: updatedRequest.id,
        tracking_code: updatedRequest.tracking_code,
        status: updatedRequest.status,
        status_label: statusLabels[updatedRequest.status],
        previous_status: request.status,
        queue_number: request.queue_number,
        queue_date: request.queue_date,
        updated_at: updatedRequest.updated_at,
        ...(status === 'rejected' && { rejection_reason: reason })
      }
    });
    
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ message: 'Failed to update request status' });
  }
};

// ===========================================
// BULK UPDATE REQUESTS STATUS (WITH FIFO VALIDATION)
// ===========================================
export const bulkUpdateRequestStatus = async (req, res) => {
  try {
    const { requestIds, status, reason } = req.body;
    const adminId = req.user.userId;

    if (!requestIds || !requestIds.length) {
      return res.status(400).json({ message: 'No request IDs provided' });
    }

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    if (status === 'rejected' && !reason) {
      return res.status(400).json({ message: 'Rejection reason is required for bulk operations' });
    }

    // Get all requests to check transitions
    const { data: requests, error: fetchError } = await supabase
      .from('requests')
      .select('id, status, tracking_code, request_type, sender_name, sender_id_number, queue_number, queue_date')
      .in('id', requestIds)
      .order('queue_date', { ascending: true })
      .order('queue_number', { ascending: true });

    if (fetchError) throw fetchError;

    // ===========================================
    // 🆕 FIFO VALIDATION FOR BULK UPDATE (with carry-over)
    // ===========================================
    const statusesRequiringFIFO = ['or_confirmed', 'processing', 'ready'];
    
    if (statusesRequiringFIFO.includes(status)) {
      // Check if the first request in the list is the next in line
      const firstRequest = requests[0];
      const isFirstNext = await isNextInLine(firstRequest.id, firstRequest);
      
      if (!isFirstNext) {
        return res.status(400).json({
          success: false,
          message: `⚠️ FIFO Order Required: Cannot process bulk update.`,
          error: `Please complete the earliest pending request first.`,
          fifoViolation: true
        });
      }
    }

    // Check for invalid transitions
    const invalidRequests = requests.filter(req => {
      const allowed = validTransitions[req.status] || [];
      return !allowed.includes(status);
    });

    if (invalidRequests.length > 0) {
      return res.status(400).json({
        message: 'Some requests cannot be transitioned to this status',
        invalidRequests: invalidRequests.map(r => ({ id: r.id, currentStatus: r.status }))
      });
    }

    // Prepare updates
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };

    const timestampFields = {
      'approved': 'approved_date',
      'processing': 'processed_date',
      'ready': 'ready_date',
      'claimed': 'claimed_date',
      'rejected': 'rejected_date'
    };

    if (timestampFields[status]) {
      updates[timestampFields[status]] = new Date().toISOString();
    }

    if (status === 'rejected') {
      updates.rejected_reason = reason;
    }

    // Update all requests
    const { data: updatedRequests, error: updateError } = await supabase
      .from('requests')
      .update(updates)
      .in('id', requestIds)
      .select();

    if (updateError) throw updateError;

    // SAVE BULK ACTIVITY LOGS
    for (const request of requests) {
      await saveAdminActivityLog(adminId, request, status, reason, req);
    }

    console.log(`✅ Bulk update: ${updatedRequests.length} requests updated to ${status}`);

    res.status(200).json({
      success: true,
      message: `${updatedRequests.length} requests updated to ${statusLabels[status]}`,
      count: updatedRequests.length,
      status: status,
      status_label: statusLabels[status]
    });

  } catch (err) {
    console.error('Bulk update error:', err);
    res.status(500).json({ message: 'Failed to bulk update requests' });
  }
};

// ===========================================
// GET AVAILABLE STATUS TRANSITIONS (WITH FIFO INFO)
// ===========================================
export const getAvailableTransitions = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: request, error } = await supabase
      .from('requests')
      .select('id, status, queue_number, queue_date')
      .eq('id', id)
      .single();

    if (error || !request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const allowed = validTransitions[request.status] || [];
    
    // 🆕 Check FIFO status for this request (with carry-over)
    const isNext = await isNextInLine(id, request);
    const firstPendingRequest = request.status === 'pending'
      ? await getFirstPendingRequest()
      : null;
    const approvalAllowed = request.status !== 'pending' || firstPendingRequest?.id === request.id;
    const approvalBlockedBy = !approvalAllowed ? firstPendingRequest : null;
    
    const transitions = allowed.map(status => ({
      status,
      label: statusLabels[status],
      requiresReason: status === 'rejected',
      disabled: status === 'approved'
        ? !approvalAllowed
        : !isNext && ['or_confirmed', 'processing', 'ready'].includes(status),
      disabledReason: status === 'approved' && !approvalAllowed
        ? `Approve Queue #${firstPendingRequest?.queue_number || 'the earlier request'} first`
        : !isNext && ['or_confirmed', 'processing', 'ready'].includes(status)
          ? `Queue #${request.queue_number} (${request.queue_date}) is not next in line`
          : null
    }));

    res.status(200).json({
      currentStatus: request.status,
      currentLabel: statusLabels[request.status],
      queue_number: request.queue_number,
      queue_date: request.queue_date,
      isNextInLine: isNext,
      approvalAllowed,
      approvalBlockedBy: approvalBlockedBy ? {
        queue_number: approvalBlockedBy.queue_number,
        queue_date: approvalBlockedBy.queue_date
      } : null,
      availableTransitions: transitions
    });

  } catch (err) {
    console.error('Get transitions error:', err);
    res.status(500).json({ message: 'Failed to get available transitions' });
  }
};

// ===========================================
// GET STATUS HISTORY
// ===========================================
export const getStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: request, error } = await supabase
      .from('requests')
      .select('status_history, tracking_code, status, updated_at, queue_number, queue_date')
      .eq('id', id)
      .single();

    if (error || !request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    let history = request.status_history || [];
    
    // Add current status if not in history
    if (!history.some(h => h.status === request.status)) {
      history.push({
        status: request.status,
        timestamp: request.updated_at || new Date().toISOString(),
        note: 'Current status'
      });
    }

    // Sort by timestamp (newest first)
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      tracking_code: request.tracking_code,
      currentStatus: request.status,
      currentLabel: statusLabels[request.status],
      queue_number: request.queue_number,
      queue_date: request.queue_date,
      history: history.map(h => ({
        ...h,
        statusLabel: statusLabels[h.status] || h.status
      }))
    });

  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ message: 'Failed to get status history' });
  }
};

// =============================================
// GET NEXT IN LINE (Only for active statuses)
// =============================================
export const getNextInLine = async (req, res) => {
  try {
    const user = req.user;
    
    // ✅ Only get requests with active status (pending, approved, processing)
    let query = supabase
      .from('requests')
      .select('queue_number, department, status, id')
      .in('status', ['pending', 'approved', 'processing'])  // Hindi kasama ang claimed at rejected
      .order('queue_date', { ascending: true })
      .order('queue_number', { ascending: true });
    
    if (user.role !== 'super_admin') {
      query = query.eq('department', user.department);
    }
    
    const { data: pendingRequests, error } = await query.limit(1);
    
    if (error) throw error;
    
    if (!pendingRequests || pendingRequests.length === 0) {
      return res.status(200).json({
        hasNext: false,
        nextRequest: null
      });
    }
    
    const nextRequest = pendingRequests[0];
    
    res.status(200).json({
      hasNext: true,
      nextRequest: {
        id: nextRequest.id,
        queue_number: nextRequest.queue_number,
        department: nextRequest.department,
        status: nextRequest.status
      }
    });
    
  } catch (err) {
    console.error('Get next in line error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ===========================================
// 🆕 GET QUEUE STATUS (For Student Dashboard)
// ===========================================
export const getQueueStatus = async (req, res) => {
  try {
    // ✅ NOW SERVING = the smallest queue_number that is NOT claimed or rejected
    // Kahit anong status (pending, approved, processing, ready) - basta hindi claimed/rejected
    const { data: currentServing, error: servingError } = await supabase
      .from('requests')
      .select('queue_number, status')
      .not('status', 'in', '("claimed","rejected")')  // ← Lahat maliban sa claimed at rejected
      .order('queue_number', { ascending: true })
      .limit(1);
    
    if (servingError) throw servingError;
    
    // Get last issued queue number (highest queue_number)
    const { data: lastQueue, error: lastError } = await supabase
      .from('requests')
      .select('queue_number')
      .order('queue_number', { ascending: false })
      .limit(1);
    
    if (lastError) throw lastError;
    
    // Get active count (all requests not claimed/rejected)
    const { count: activeCount, error: activeError } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("claimed","rejected")');
    
    if (activeError) throw activeError;
    
    // Check for carry-over requests
    const today = new Date().toISOString().split('T')[0];
    const { data: carryOverCheck, error: carryError } = await supabase
      .from('requests')
      .select('queue_date')
      .not('status', 'in', '("claimed","rejected")')
      .lt('queue_date', today)
      .limit(1);
    
    const currentServingNumber = currentServing?.[0]?.queue_number || null;
    const currentServingStatus = currentServing?.[0]?.status || null;
    
    console.log('📊 Queue Status Response:', {
      current_serving: currentServingNumber,
      current_status: currentServingStatus,
      last_queue_number: lastQueue?.[0]?.queue_number || null,
      active_count: activeCount || 0,
      has_carry_over: carryOverCheck && carryOverCheck.length > 0
    });
    
    res.status(200).json({
      success: true,
      current_serving: currentServingNumber,
      last_queue_number: lastQueue?.[0]?.queue_number || null,
      pending_count: activeCount || 0,
      has_carry_over: carryOverCheck && carryOverCheck.length > 0,
      last_updated: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Get queue status error:', err);
    res.status(500).json({ message: 'Failed to get queue status' });
  }
};